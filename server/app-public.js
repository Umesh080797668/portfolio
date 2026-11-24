'use strict';

/**
 * PUBLIC app: the portfolio website and the visitor API.
 * It contains NO admin routes and NO admin code. The admin dashboard is a separate
 * server (see app-admin.js) on a different port/host.
 */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { normalizeTrackingCode } = require('./lib/codes');
const { schemas } = require('./lib/validate');
const {
    cleanText, signUploadToken, verifyUploadToken, isBlockedFileName, limiter
} = require('./lib/security');
const {
    HttpError, CLOSED_STATUSES, MAX_CLIENT_FILES_PER_ORDER, toPublicView, verifyUploads
} = require('./lib/orders');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function createPublicApp({ cfg, store, storage, bus, rootDir }) {
    const root = rootDir || path.join(__dirname, '..');
    const app = express();
    const streamsByIp = new Map();

    app.disable('x-powered-by');
    app.set('trust proxy', cfg.trustProxy);

    app.use(helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
                fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
                imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
                connectSrc: ["'self'", 'https://api.cloudinary.com', 'https://formspree.io'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'", 'https://formspree.io'],
                frameAncestors: ["'none'"],
                ...(cfg.isProd ? { upgradeInsecureRequests: [] } : {})
            }
        },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    }));

    /* ---------- Public (non-secret) browser configuration ---------- */
    app.get('/config.js', (req, res) => {
        const publicConfig = Object.assign({
            apiBase: cfg.apiBase,
            maxFileMb: Math.round(cfg.limits.maxFileBytes / 1048576),
            maxFiles: cfg.limits.maxFiles
        }, cfg.publicClient);
        res.set('Cache-Control', 'no-cache');
        res.type('application/javascript').send(`window.__TAL_CONFIG__=${JSON.stringify(publicConfig)};`);
    });

    /* ---------- API ---------- */
    const api = express.Router();
    if (cfg.corsOrigins.length) {
        api.use(cors({ origin: cfg.corsOrigins, methods: ['GET', 'POST'], maxAge: 600 }));
    }
    api.use(limiter(60 * 1000, cfg.rate.api));
    api.use(express.json({ limit: '64kb' }));
    api.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

    const trackLimiter = limiter(60 * 1000, cfg.rate.track, 'Too many tracking attempts. Please wait a minute.');
    const signLimiter = limiter(10 * 60 * 1000, cfg.rate.sign);
    const submitLimiter = limiter(60 * 60 * 1000, cfg.rate.submit, 'You have sent several requests already. Please try again later or contact me on WhatsApp.');
    const moreFilesLimiter = limiter(60 * 60 * 1000, cfg.rate.submit * 4, 'Too many uploads. Please try again later.');

    const incomingBase = `${cfg.cloudinary.folder}/incoming/`;
    const orderFolder = (code) => `${cfg.cloudinary.folder}/orders/${code}/client`;

    async function findOpenOrder(rawCode) {
        const code = normalizeTrackingCode(rawCode);
        if (!code) return null;
        const order = await store.getOrderByCode(code);
        return order && order.tracking_code ? order : null;
    }

    const notFound = (res) => res.status(404).json({ error: 'No work found for that tracking code.' });

    /* 1) Get a signed upload (one call per file) */
    api.post('/uploads/sign', signLimiter, asyncHandler(async (req, res) => {
        const parsed = schemas.signUpload.safeParse(req.body);
        if (!parsed.success) throw new HttpError(400, 'Invalid upload request.');
        const body = parsed.data;

        if (isBlockedFileName(body.fileName)) throw new HttpError(400, 'This file type is not allowed.');
        if (body.size > cfg.limits.maxFileBytes) {
            throw new HttpError(413, `Files must be smaller than ${Math.round(cfg.limits.maxFileBytes / 1048576)} MB.`);
        }

        let folder;
        if (body.code) {
            const order = await findOpenOrder(body.code);
            if (!order) return notFound(res);
            if (CLOSED_STATUSES.includes(order.status)) throw new HttpError(400, 'This work is closed.');
            folder = orderFolder(order.tracking_code);
        } else if (body.folder && body.token
            && body.folder.startsWith(incomingBase)
            && verifyUploadToken(cfg.uploadTokenSecret, body.folder, body.token)) {
            folder = body.folder; // another file for the same request
        } else {
            folder = `${incomingBase}${crypto.randomBytes(8).toString('hex')}`;
        }

        const signed = storage.signUpload(folder, body.fileName);
        res.json({
            folder,
            token: signUploadToken(cfg.uploadTokenSecret, folder),
            uploadUrl: signed.uploadUrl,
            fields: signed.fields
        });
    }));

    /* 2) Send a new request (+ already uploaded files + optional quotation) */
    api.post('/requests', submitLimiter, asyncHandler(async (req, res) => {
        const parsed = schemas.submitRequest.safeParse(req.body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            throw new HttpError(400, first ? first.message : 'Invalid request.');
        }
        const d = parsed.data;

        // Honeypot: bots fill hidden fields. Pretend success, store nothing.
        if (d.website) return res.status(201).json({ ok: true, reference: 'REQ-00000000' });

        const files = await verifyUploads({
            cfg,
            storage,
            descriptors: d.files,
            folderAllowed: (folder) => folder.startsWith(incomingBase)
        });

        const order = await store.createOrder({
            client_name: cleanText(d.name),
            client_phone: cleanText(d.phone),
            client_email: cleanText(d.email).toLowerCase(),
            client_org: cleanText(d.org),
            title: cleanText(d.title),
            details: cleanText(d.details),
            source: 'portfolio',
            status: 'pending_review',
            progress: 0,
            quote_no: d.quote ? cleanText(d.quote.no) : '',
            quote_total: d.quote ? d.quote.total : null,
            quote_lines: d.quote ? d.quote.lines : null
        });

        await store.addUpdate({
            order_id: order.id,
            status: 'pending_review',
            progress: 0,
            message: 'Request received. It will be reviewed shortly.',
            is_public: false,
            created_by: 'visitor'
        });
        await store.addFiles(files.map((f) => Object.assign({}, f, {
            order_id: order.id, visibility: 'client_upload', uploaded_by: 'client'
        })));
        await store.audit({ actor: 'visitor', action: 'request.created', target: order.id, ip: req.ip, meta: { files: files.length } });

        res.status(201).json({ ok: true, reference: `REQ-${String(order.id).slice(0, 8).toUpperCase()}` });
    }));

    /* 3) Track work with a code */
    api.get('/track/:code', trackLimiter, asyncHandler(async (req, res) => {
        const order = await findOpenOrder(req.params.code);
        if (!order) return notFound(res);
        const [updates, files] = await Promise.all([store.listUpdates(order.id, { publicOnly: true }), store.listFiles(order.id)]);
        res.json(toPublicView(order, updates, files));
    }));

    /* 4) Live updates (Server-Sent Events) */
    api.get('/track/:code/stream', trackLimiter, asyncHandler(async (req, res) => {
        const order = await findOpenOrder(req.params.code);
        if (!order) return notFound(res);

        const ip = req.ip;
        const open = streamsByIp.get(ip) || 0;
        if (open >= cfg.rate.streamsPerIp) return res.status(429).json({ error: 'Too many open live connections.' });
        streamsByIp.set(ip, open + 1);

        res.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no'
        });
        res.flushHeaders();
        res.write('retry: 4000\n\nevent: ready\ndata: {}\n\n');

        let timer = null;
        const off = bus.subscribe(order.id, () => {
            // several changes can arrive together; the browser just needs one nudge
            if (timer) return;
            timer = setTimeout(() => { timer = null; res.write('event: change\ndata: {}\n\n'); }, 150);
        });
        const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
        const maxAge = setTimeout(() => res.end(), 30 * 60 * 1000); // browser reconnects automatically

        let closed = false;
        res.on('close', () => {
            if (closed) return;
            closed = true;
            off();
            clearInterval(keepAlive);
            clearTimeout(maxAge);
            if (timer) clearTimeout(timer);
            const left = (streamsByIp.get(ip) || 1) - 1;
            if (left <= 0) streamsByIp.delete(ip); else streamsByIp.set(ip, left);
        });
    }));

    /* 5) Download a finished file (deliverable) */
    api.get('/track/:code/files/:fileId', trackLimiter, asyncHandler(async (req, res) => {
        const order = await findOpenOrder(req.params.code);
        if (!order) return notFound(res);
        const file = await store.getFile(req.params.fileId);
        if (!file || file.order_id !== order.id || file.visibility !== 'deliverable') return notFound(res);
        res.redirect(302, storage.downloadUrl(file, 300));
    }));

    /* 6) Send more files for work that already has a code */
    api.post('/track/:code/files', trackLimiter, moreFilesLimiter, asyncHandler(async (req, res) => {
        const order = await findOpenOrder(req.params.code);
        if (!order) return notFound(res);
        if (CLOSED_STATUSES.includes(order.status)) throw new HttpError(400, 'This work is closed.');

        const parsed = schemas.clientFiles.safeParse(req.body);
        if (!parsed.success) throw new HttpError(400, 'Invalid files.');

        const existing = (await store.listFiles(order.id, 'client_upload')).length;
        if (existing + parsed.data.files.length > MAX_CLIENT_FILES_PER_ORDER) {
            throw new HttpError(400, 'File limit reached for this work. Please contact me.');
        }

        const expectedFolder = orderFolder(order.tracking_code);
        const files = await verifyUploads({
            cfg, storage, descriptors: parsed.data.files, folderAllowed: (folder) => folder === expectedFolder
        });
        await store.addFiles(files.map((f) => Object.assign({}, f, {
            order_id: order.id, visibility: 'client_upload', uploaded_by: 'client'
        })));
        await store.addUpdate({
            order_id: order.id,
            status: order.status,
            progress: order.progress,
            message: `You sent ${files.length} new file${files.length > 1 ? 's' : ''}.`,
            is_public: true,
            created_by: 'visitor'
        });
        await store.updateOrder(order.id, {});
        bus.publish(order.id);
        res.status(201).json({ ok: true, added: files.length });
    }));

    app.use('/api', api);
    app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

    /* ---------- Static website (explicit allow-list: nothing else on disk is reachable) ---------- */
    const staticOptions = { dotfiles: 'ignore', index: false, fallthrough: true, maxAge: cfg.isProd ? '1h' : 0 };
    ['css', 'js', 'assets'].forEach((dir) => {
        app.use(`/${dir}`, express.static(path.join(root, dir), staticOptions));
    });
    app.get('/', (req, res) => res.sendFile(path.join(root, 'index.html'), { dotfiles: 'ignore' }));
    app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\n'));

    app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
        if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
        console.error('[public] unexpected error:', err && err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    });

    return app;
}

module.exports = { createPublicApp };

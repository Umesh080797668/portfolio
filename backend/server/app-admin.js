'use strict';

/**
 * ADMIN app: dashboard + admin API. Runs as a separate server (own port, bound to localhost
 * by default) so none of this exists on the public website.
 *
 * Every /api/admin request must carry a Supabase Auth access token and pass ALL of:
 *   1. token is valid and not revoked (verified by Supabase, not just decoded)
 *   2. the e-mail address is confirmed
 *   3. the e-mail is in ADMIN_EMAILS (allow-list)
 *   4. the session completed TOTP two-factor authentication (aal2) when ADMIN_REQUIRE_MFA=true
 * Every change is written to the audit log.
 */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');

const { schemas, UUID } = require('./lib/validate');
const {
    cleanText, signUploadToken, verifyUploadToken, isBlockedFileName, limiter
} = require('./lib/security');
const {
    HttpError, STATUSES, verifyUploads
} = require('./lib/orders');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function createAdminApp({ cfg, store, storage, auth, live, rootDir }) {
    const root = rootDir || path.join(__dirname, '..');
    const app = express();

    app.disable('x-powered-by');
    app.set('trust proxy', cfg.trustProxy);

    let supabaseOrigin = '';
    try { supabaseOrigin = new URL(cfg.supabase.url).origin; } catch (e) { /* tests */ }

    app.use(helmet({
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'same-origin' },
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'none'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", 'data:'],
                fontSrc: ["'self'"],
                connectSrc: ["'self'", ...(supabaseOrigin ? [supabaseOrigin] : []), 'https://api.cloudinary.com'],
                baseUri: ["'none'"],
                formAction: ["'none'"],
                frameAncestors: ["'none'"],
                objectSrc: ["'none'"],
                ...(cfg.isProd ? { upgradeInsecureRequests: [] } : {})
            }
        },
        referrerPolicy: { policy: 'no-referrer' }
    }));
    app.use((req, res, next) => {
        res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' });
        next();
    });

    app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));

    // Public Supabase values only (URL + anon key). The anon key is safe by design: all tables deny it.
    app.get('/config.js', (req, res) => {
        res.type('application/javascript').send(`window.__ADMIN_CONFIG__=${JSON.stringify({
            supabaseUrl: cfg.supabase.url,
            supabaseAnonKey: cfg.supabase.anonKey,
            requireMfa: cfg.admin.requireMfa,
            frontendUrl: cfg.frontendUrl
        })};`);
    });

    app.use(express.static(path.join(root, 'admin'), { dotfiles: 'ignore', index: 'index.html', maxAge: 0 }));

    /* ---------- Admin API ---------- */
    const api = express.Router();
    api.use(limiter(60 * 1000, cfg.rate.admin));
    api.use(express.json({ limit: '256kb' }));

    const audit = (req, action, target, meta) => store.audit({
        actor: req.admin ? req.admin.email : 'anonymous',
        action,
        target: target || null,
        ip: req.ip,
        meta: meta || null
    });

    api.use(asyncHandler(async (req, res, next) => {
        const m = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '');
        if (!m) return res.status(401).json({ error: 'unauthorized' });

        let user;
        try {
            user = await auth.verifyToken(m[1]);
        } catch (e) {
            return res.status(401).json({ error: 'unauthorized' });
        }

        if (!user.emailConfirmed || !cfg.admin.emails.includes(user.email)) {
            await store.audit({ actor: user.email || 'unknown', action: 'admin.denied', target: null, ip: req.ip, meta: { reason: 'not_allowed' } });
            return res.status(403).json({ error: 'forbidden' });
        }
        if (cfg.admin.requireMfa && user.aal !== 'aal2') {
            return res.status(403).json({ error: 'mfa_required' });
        }
        req.admin = user;
        next();
    }));

    // Tell visitors watching this order that it changed (a data-free ping; they re-fetch from the API)
    const notify = async (order) => { if (live && order) await live.publish(order); };

    const orderIdParam = (req) => {
        if (!UUID.test(req.params.id)) throw new HttpError(400, 'Invalid id');
        return req.params.id;
    };

    async function requireOrder(req) {
        const order = await store.getOrder(orderIdParam(req));
        if (!order) throw new HttpError(404, 'Order not found');
        return order;
    }

    const parse = (schema, body) => {
        const r = schema.safeParse(body);
        if (!r.success) {
            const i = r.error.issues[0];
            throw new HttpError(400, i ? `${i.path.join('.') || 'request'}: ${i.message}` : 'Invalid request');
        }
        return r.data;
    };

    const trackUrl = (code) => (cfg.frontendUrl && code ? `${cfg.frontendUrl}/services.html?track=${encodeURIComponent(code)}#track` : null);
    const withLinks = (order) => Object.assign({}, order, { track_url: trackUrl(order.tracking_code) });

    api.get('/admin/me', (req, res) => res.json({ email: req.admin.email, statuses: STATUSES }));

    api.get('/admin/orders', asyncHandler(async (req, res) => {
        const status = STATUSES.includes(req.query.status) ? req.query.status : undefined;
        const q = typeof req.query.q === 'string' ? cleanText(req.query.q).slice(0, 80) : '';
        const orders = await store.listOrders({ status, q, limit: 200 });
        res.json({ orders: orders.map(withLinks) });
    }));

    api.get('/admin/orders/:id', asyncHandler(async (req, res) => {
        const order = await requireOrder(req);
        const [updates, files] = await Promise.all([store.listUpdates(order.id), store.listFiles(order.id)]);
        res.json({ order: withLinks(order), updates, files });
    }));

    // Create a job yourself, e.g. a client who contacted you on WhatsApp
    api.post('/admin/orders', asyncHandler(async (req, res) => {
        const d = parse(schemas.adminCreateOrder, req.body);
        let order = await store.createOrder({
            client_name: cleanText(d.name),
            client_phone: cleanText(d.phone),
            client_email: cleanText(d.email).toLowerCase(),
            client_org: cleanText(d.org),
            title: cleanText(d.title),
            details: cleanText(d.details),
            source: d.source,
            status: d.issueCode ? 'accepted' : 'pending_review',
            progress: 0,
            due_date: d.dueDate || null,
            quote_no: cleanText(d.quoteNo),
            quote_total: d.quoteTotal === undefined ? null : d.quoteTotal,
            internal_notes: cleanText(d.internalNotes),
            accepted_at: d.issueCode ? new Date().toISOString() : null
        });
        if (d.issueCode) {
            order = await store.assignTrackingCode(order.id);
            await store.addUpdate({
                order_id: order.id, status: 'accepted', progress: 0,
                message: 'Your work has been accepted. You can follow its progress here.',
                is_public: true, created_by: req.admin.email
            });
        } else {
            await store.addUpdate({
                order_id: order.id, status: 'pending_review', progress: 0,
                message: 'Created manually.', is_public: false, created_by: req.admin.email
            });
        }
        await audit(req, 'order.created', order.id, { source: d.source, code: !!order.tracking_code });
        res.status(201).json({ order: withLinks(order) });
    }));

    api.patch('/admin/orders/:id', asyncHandler(async (req, res) => {
        const order = await requireOrder(req);
        const d = parse(schemas.adminPatchOrder, req.body);
        const map = {
            name: 'client_name', phone: 'client_phone', email: 'client_email', org: 'client_org',
            title: 'title', details: 'details', quoteNo: 'quote_no', quoteTotal: 'quote_total',
            dueDate: 'due_date', internalNotes: 'internal_notes'
        };
        const patch = {};
        Object.keys(d).forEach((k) => {
            patch[map[k]] = typeof d[k] === 'string' ? cleanText(d[k]) : d[k];
        });
        const updated = await store.updateOrder(order.id, patch);
        await audit(req, 'order.edited', order.id, { fields: Object.keys(d) });
        await notify(updated);
        res.json({ order: withLinks(updated) });
    }));

    // Accept = issue the tracking code
    api.post('/admin/orders/:id/accept', asyncHandler(async (req, res) => {
        const order = await requireOrder(req);
        if (order.tracking_code) throw new HttpError(409, 'This order already has a tracking code.');
        if (order.status !== 'pending_review') throw new HttpError(409, 'Only requests waiting for review can be accepted.');
        const updated = await store.assignTrackingCode(order.id, { status: 'accepted', accepted_at: new Date().toISOString() });
        await store.addUpdate({
            order_id: order.id, status: 'accepted', progress: updated.progress || 0,
            message: 'Your request has been accepted. You can follow its progress here.',
            is_public: true, created_by: req.admin.email
        });
        await audit(req, 'order.accepted', order.id);
        await notify(updated);
        res.json({ order: withLinks(updated) });
    }));

    api.post('/admin/orders/:id/reject', asyncHandler(async (req, res) => {
        const order = await requireOrder(req);
        const d = parse(schemas.adminReject, req.body);
        if (order.status !== 'pending_review') throw new HttpError(409, 'Only requests waiting for review can be rejected.');
        const updated = await store.updateOrder(order.id, { status: 'rejected' });
        await store.addUpdate({
            order_id: order.id, status: 'rejected', progress: 0,
            message: cleanText(d.reason) || 'Request declined.', is_public: false, created_by: req.admin.email
        });
        await audit(req, 'order.rejected', order.id);
        res.json({ order: withLinks(updated) });
    }));

    // Replace the code (use if it was shared by mistake). The old code stops working immediately.
    api.post('/admin/orders/:id/regenerate-code', asyncHandler(async (req, res) => {
        const order = await requireOrder(req);
        if (!order.tracking_code) throw new HttpError(409, 'Accept the request first.');
        const previous = { id: order.id, tracking_code: order.tracking_code }; // copy: the old code decides the old channel
        const updated = await store.assignTrackingCode(order.id);
        await audit(req, 'order.code_regenerated', order.id);
        await notify(previous); // viewers of the OLD code refresh and see it no longer works
        res.json({ order: withLinks(updated) });
    }));

    // Status / progress / message shown on the visitor's tracking page
    api.post('/admin/orders/:id/updates', asyncHandler(async (req, res) => {
        const order = await requireOrder(req);
        const d = parse(schemas.adminAddUpdate, req.body);
        if (!order.tracking_code && d.isPublic) {
            throw new HttpError(409, 'Accept the request first. Visitors cannot see updates without a tracking code.');
        }

        const patch = {};
        if (d.status) patch.status = d.status;
        if (d.progress !== undefined) patch.progress = d.progress;
        if (d.status === 'completed' && d.progress === undefined) patch.progress = 100;
        if (d.dueDate !== undefined) patch.due_date = d.dueDate;

        const updated = Object.keys(patch).length ? await store.updateOrder(order.id, patch) : order;
        const entry = await store.addUpdate({
            order_id: order.id,
            status: updated.status,
            progress: updated.progress,
            message: cleanText(d.message),
            is_public: d.isPublic,
            created_by: req.admin.email
        });
        await audit(req, 'order.updated', order.id, { status: updated.status, progress: updated.progress, public: d.isPublic });
        if (d.isPublic) await notify(updated);
        res.status(201).json({ order: withLinks(updated), update: entry });
    }));

    api.delete('/admin/orders/:id', asyncHandler(async (req, res) => {
        const order = await requireOrder(req);
        const files = await store.listFiles(order.id);
        await storage.remove(files);
        await store.deleteOrder(order.id);
        await audit(req, 'order.deleted', order.id, { files: files.length });
        await notify(order);
        res.json({ ok: true });
    }));

    /* ----- Files ----- */
    api.post('/admin/uploads/sign', asyncHandler(async (req, res) => {
        const body = parse(schemas.adminSign, req.body);
        if (isBlockedFileName(body.fileName)) throw new HttpError(400, 'This file type is not allowed.');
        if (body.size > cfg.limits.maxFileBytes) throw new HttpError(413, 'File is too large.');

        const base = `${cfg.cloudinary.folder}/deliverables/`;
        let folder;
        if (body.folder && body.token && body.folder.startsWith(base)
            && verifyUploadToken(cfg.uploadTokenSecret, body.folder, body.token)) {
            folder = body.folder;
        } else {
            folder = `${base}${crypto.randomBytes(8).toString('hex')}`;
        }
        const signed = storage.signUpload(folder, body.fileName);
        res.json({ folder, token: signUploadToken(cfg.uploadTokenSecret, folder), uploadUrl: signed.uploadUrl, fields: signed.fields });
    }));

    // Attach finished work (deliverables) so the client can download it from the tracking page
    api.post('/admin/orders/:id/files', asyncHandler(async (req, res) => {
        const order = await requireOrder(req);
        const d = parse(schemas.adminRegisterFiles, req.body);
        const base = `${cfg.cloudinary.folder}/deliverables/`;
        const files = await verifyUploads({
            cfg, storage, descriptors: d.files, folderAllowed: (folder) => folder.startsWith(base)
        });
        const saved = await store.addFiles(files.map((f) => Object.assign({}, f, {
            order_id: order.id, visibility: 'deliverable', uploaded_by: req.admin.email
        })));
        if (order.tracking_code) {
            await store.addUpdate({
                order_id: order.id, status: order.status, progress: order.progress,
                message: `${files.length} file${files.length > 1 ? 's are' : ' is'} ready to download.`,
                is_public: true, created_by: req.admin.email
            });
            await store.updateOrder(order.id, {});
        }
        await audit(req, 'files.deliverable_added', order.id, { count: files.length });
        await notify(order);
        res.status(201).json({ files: saved });
    }));

    api.get('/admin/files/:id/download', asyncHandler(async (req, res) => {
        if (!UUID.test(req.params.id)) throw new HttpError(400, 'Invalid id');
        const file = await store.getFile(req.params.id);
        if (!file) throw new HttpError(404, 'File not found');
        await audit(req, 'file.downloaded', file.order_id, { file: file.id });
        res.json({ url: storage.downloadUrl(file, 300), name: file.original_name });
    }));

    api.get('/admin/audit', asyncHandler(async (req, res) => {
        res.json({ entries: await store.listAudit(100) });
    }));

    app.use('/api', api);
    app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

    app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
        console.error('[admin] unexpected error:', err && err.message);
        res.status(500).json({ error: 'Server error' });
    });

    return app;
}

module.exports = { createAdminApp };

'use strict';

const crypto = require('crypto');
const { buildConfig } = require('../../server/config');
const { generateTrackingCode } = require('../../server/lib/codes');
const { createLiveNotifier } = require('../../server/lib/live');
const { createPublicApp } = require('../../server/app-public');
const { createAdminApp } = require('../../server/app-admin');

function createMemoryStore() {
    const orders = []; const updates = []; const files = []; const auditLog = [];
    const now = () => new Date().toISOString();
    return {
        _orders: orders, _updates: updates, _files: files, _audit: auditLog,
        async createOrder(o) {
            const row = Object.assign({
                id: crypto.randomUUID(), tracking_code: null, internal_notes: '', due_date: null,
                accepted_at: null, created_at: now(), updated_at: now()
            }, o);
            orders.push(row); return row;
        },
        async getOrder(id) { return orders.find((o) => o.id === id) || null; },
        async getOrderByCode(code) { return orders.find((o) => o.tracking_code === code) || null; },
        async listOrders({ status, q }) {
            return orders.filter((o) => (!status || o.status === status)
                && (!q || JSON.stringify(o).toLowerCase().includes(q.toLowerCase())));
        },
        async updateOrder(id, patch) { const o = orders.find((x) => x.id === id); Object.assign(o, patch, { updated_at: now() }); return o; },
        async assignTrackingCode(id, extra) {
            const o = orders.find((x) => x.id === id);
            Object.assign(o, extra || {}, { tracking_code: generateTrackingCode(), updated_at: now() });
            return o;
        },
        async deleteOrder(id) {
            const i = orders.findIndex((o) => o.id === id); if (i >= 0) orders.splice(i, 1);
            for (let k = files.length - 1; k >= 0; k -= 1) if (files[k].order_id === id) files.splice(k, 1);
            for (let k = updates.length - 1; k >= 0; k -= 1) if (updates[k].order_id === id) updates.splice(k, 1);
        },
        async addUpdate(u) { const row = Object.assign({ id: crypto.randomUUID(), created_at: now() }, u); updates.push(row); return row; },
        async listUpdates(orderId, { publicOnly } = {}) {
            return updates.filter((u) => u.order_id === orderId && (!publicOnly || u.is_public)).reverse();
        },
        async addFiles(list) { const rows = list.map((f) => Object.assign({ id: crypto.randomUUID(), created_at: now() }, f)); files.push(...rows); return rows; },
        async listFiles(orderId, visibility) { return files.filter((f) => f.order_id === orderId && (!visibility || f.visibility === visibility)); },
        async getFile(id) { return files.find((f) => f.id === id) || null; },
        async audit(entry) { auditLog.push(entry); },
        async listAudit() { return auditLog.slice().reverse(); }
    };
}

function createFakeStorage() {
    const objects = new Map();
    return {
        _objects: objects,
        put(publicId, info) {
            objects.set(publicId, Object.assign({ resourceType: 'raw', format: 'pdf', bytes: 1000, originalName: 'brief' }, info, { publicId }));
        },
        signUpload(folder, fileName) { return { uploadUrl: 'https://upload.test/auto/upload', fields: { public_id: `${folder}/ab12cd34_${fileName}`, type: 'authenticated', signature: 'sig', api_key: 'key' } }; },
        async inspect(publicId) { return objects.get(publicId) || null; },
        downloadUrl(file) { return `https://dl.test/${file.public_id}`; },
        async remove(list) { list.forEach((f) => objects.delete(f.public_id)); }
    };
}

const fakeAuth = {
    async verifyToken(token) {
        const users = {
            'admin-ok': { id: 'u1', email: 'admin@example.com', emailConfirmed: true, aal: 'aal2' },
            'admin-aal1': { id: 'u1', email: 'admin@example.com', emailConfirmed: true, aal: 'aal1' },
            'admin-unconfirmed': { id: 'u1', email: 'admin@example.com', emailConfirmed: false, aal: 'aal2' },
            'stranger': { id: 'u2', email: 'stranger@example.com', emailConfirmed: true, aal: 'aal2' }
        };
        if (!users[token]) throw new Error('bad token');
        return users[token];
    }
};

const BASE_ENV = {
    NODE_ENV: 'test',
    ADMIN_EMAILS: 'Admin@Example.com',
    UPLOAD_TOKEN_SECRET: 'x'.repeat(48),
    CLOUDINARY_FOLDER: 'testfolder',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    FRONTEND_URL: 'https://site.test',
    RATE_API_PER_MIN: '10000', RATE_TRACK_PER_MIN: '10000', RATE_SIGN_PER_10MIN: '10000',
    RATE_SUBMIT_PER_HOUR: '10000', RATE_ADMIN_PER_MIN: '10000'
};

async function startApps(envOverrides) {
    const cfg = buildConfig(Object.assign({}, BASE_ENV, envOverrides));
    const store = createMemoryStore();
    const storage = createFakeStorage();
    const live = createLiveNotifier(cfg);
    const pings = [];
    live.publish = async (order) => { pings.push(live.channelFor(order)); return true; }; // record instead of calling Supabase
    const pub = createPublicApp({ cfg, store, storage, live });
    const adm = createAdminApp({ cfg, store, storage, auth: fakeAuth, live });
    const pubServer = await new Promise((r) => { const s = pub.listen(0, '127.0.0.1', () => r(s)); });
    const admServer = await new Promise((r) => { const s = adm.listen(0, '127.0.0.1', () => r(s)); });
    const pubUrl = `http://127.0.0.1:${pubServer.address().port}`;
    const admUrl = `http://127.0.0.1:${admServer.address().port}`;
    return {
        cfg, store, storage, live, pings, pub, adm, pubUrl, admUrl,
        async close() { pubServer.closeAllConnections(); admServer.closeAllConnections(); pubServer.close(); admServer.close(); }
    };
}

module.exports = { startApps, createMemoryStore, createFakeStorage };

'use strict';

/**
 * LOCAL UI TESTING ONLY. Runs both apps with an in-memory database, a fake storage and a
 * fake login, so the pages can be exercised without Supabase or Cloudinary.
 * The fake login accepts a fixed token, so this file refuses to run in production.
 */
if (process.env.NODE_ENV === 'production') {
    console.error('tests/dev-server.js must never run in production');
    process.exit(1);
}

const { buildConfig } = require('../server/config');
const { createBus } = require('../server/lib/bus');
const { createPublicApp } = require('../server/app-public');
const { createAdminApp } = require('../server/app-admin');
const { createMemoryStore, createFakeStorage } = require('./helpers/fakes');

const cfg = buildConfig({
    NODE_ENV: 'development',
    ADMIN_EMAILS: 'admin@example.com',
    UPLOAD_TOKEN_SECRET: 'd'.repeat(48),
    CLOUDINARY_FOLDER: 'demo',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon-demo',
    PUBLIC_BASE_URL: 'http://127.0.0.1:3100',
    PUBLIC_PORT: '3100', ADMIN_PORT: '3101',
    WHATSAPP_NUMBER: '94704124816', FORMSPREE_FORM_ID: 'demoform'
});

const store = createMemoryStore();
const storage = createFakeStorage();
// accept whatever the test browser "uploaded"
storage.inspect = async (publicId, resourceType) => ({
    publicId, resourceType: 'raw', format: 'pdf', bytes: 123456, originalName: ''
});
const realSign = storage.signUpload;
storage.signUpload = (folder, fileName) => Object.assign(realSign(folder, fileName), { uploadUrl: 'https://api.cloudinary.com/v1_1/demo/auto/upload' });
const bus = createBus();
const auth = { async verifyToken(t) {
    if (t !== 'admin-ok') throw new Error('bad');
    return { id: 'u1', email: 'admin@example.com', emailConfirmed: true, aal: 'aal2' };
} };

createPublicApp({ cfg, store, storage, bus }).listen(cfg.publicPort, '127.0.0.1', () => console.log('public 3100'));
createAdminApp({ cfg, store, storage, auth, bus }).listen(cfg.adminPort, '127.0.0.1', () => console.log('admin 3101'));

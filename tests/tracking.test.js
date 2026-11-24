'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startApps } = require('./helpers/fakes');
const { generateTrackingCode, normalizeTrackingCode } = require('../server/lib/codes');
const { signUploadToken, verifyUploadToken, isBlockedFileName } = require('../server/lib/security');

const json = (body, headers) => ({
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(body)
});
const adminHeaders = (token) => ({ Authorization: `Bearer ${token || 'admin-ok'}` });

async function signAndRegister(ctx, fileName, extra) {
    const res = await fetch(`${ctx.pubUrl}/api/uploads/sign`, json(Object.assign({ fileName, size: 2000 }, extra || {})));
    const sign = await res.json();
    return { res, sign };
}

/* ------------------------------------------------------------------ units */
test('tracking codes: format, alphabet and normalisation', () => {
    for (let i = 0; i < 200; i += 1) {
        const code = generateTrackingCode();
        assert.match(code, /^TAL-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/);
        assert.equal(normalizeTrackingCode(code.toLowerCase().replace(/-/g, ' ')), code);
        assert.equal(normalizeTrackingCode(code.replace(/-/g, '')), code);
    }
    assert.equal(normalizeTrackingCode('TAL-AAAA0-BBBBB'), null); // 0 is not in the alphabet
    assert.equal(normalizeTrackingCode('nonsense'), null);
    assert.equal(normalizeTrackingCode(null), null);
    assert.equal(normalizeTrackingCode('A'.repeat(100)), null);
});

test('upload tokens: valid, wrong folder, expired, tampered', () => {
    const secret = 's'.repeat(40);
    const token = signUploadToken(secret, 'a/b');
    assert.ok(verifyUploadToken(secret, 'a/b', token));
    assert.ok(!verifyUploadToken(secret, 'a/c', token));
    assert.ok(!verifyUploadToken(secret, 'a/b', token + 'x'));
    assert.ok(!verifyUploadToken('t'.repeat(40), 'a/b', token));
    assert.ok(!verifyUploadToken(secret, 'a/b', signUploadToken(secret, 'a/b', Date.now() - 2 * 3600 * 1000)));
});

test('blocked file names include double extensions', () => {
    assert.ok(isBlockedFileName('setup.exe'));
    assert.ok(isBlockedFileName('invoice.pdf.exe'));
    assert.ok(isBlockedFileName('RUN.BAT'));
    assert.ok(!isBlockedFileName('report.pdf'));
    assert.ok(!isBlockedFileName('data.xlsx'));
    assert.ok(!isBlockedFileName('notes.txt'));
});

/* ------------------------------------------------------------------ exposure */
test('public server exposes no secrets, no server code and no admin routes', async () => {
    const ctx = await startApps();
    try {
        for (const p of ['/.env', '/.env.example', '/package.json', '/server/index.js', '/server/config.js',
            '/admin/index.html', '/admin/admin.js', '/supabase/schema.sql', '/node_modules/express/package.json',
            '/.git/config', '/js/../.env', '/api/admin/orders', '/css/../server/config.js']) {
            const r = await fetch(ctx.pubUrl + p);
            assert.ok([401, 403, 404].includes(r.status), `${p} -> ${r.status}`);
        }
        const cfgJs = await (await fetch(`${ctx.pubUrl}/config.js`)).text();
        for (const secretish of ['SECRET', 'service', 'xxxxxxxx', 'api_secret']) assert.ok(!cfgJs.includes(secretish));
        const home = await fetch(ctx.pubUrl + '/');
        assert.equal(home.status, 200);
        assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    } finally { await ctx.close(); }
});

/* ------------------------------------------------------------------ visitor request flow */
test('visitor request -> no code until accepted -> accepted -> tracked', async () => {
    const ctx = await startApps();
    try {
        const { sign } = await signAndRegister(ctx, 'brief.pdf');
        assert.ok(sign.folder.startsWith('testfolder/incoming/'));
        assert.ok(sign.fields.public_id.startsWith(`${sign.folder}/`));
        ctx.storage.put(`${sign.folder}/brief_abc`, { bytes: 2000, originalName: 'brief', format: 'pdf' });

        const bad = await fetch(`${ctx.pubUrl}/api/requests`, json({ name: 'Kamal Perera', phone: '0771234567', title: 'Need a website', consent: false }));
        assert.equal(bad.status, 400);

        const created = await fetch(`${ctx.pubUrl}/api/requests`, json({
            name: 'Kamal Perera', phone: '0771234567', email: 'kamal@example.com', title: 'Need a website',
            details: 'Small shop', consent: true,
            files: [{ publicId: `${sign.folder}/brief_abc`, resourceType: 'raw', folder: sign.folder, token: sign.token }],
            quote: { no: 'TAL-261124-001', total: 25000, lines: [{ name: 'Small business website', qty: 1, amount: 25000 }] }
        }));
        assert.equal(created.status, 201);
        const body = await created.json();
        assert.match(body.reference, /^REQ-[0-9A-F]{8}$/);
        assert.ok(!('code' in body) && !('trackingCode' in body));

        const order = ctx.store._orders[0];
        assert.equal(order.status, 'pending_review');
        assert.equal(order.tracking_code, null);
        assert.equal(ctx.store._files.length, 1);

        // nothing to track before acceptance
        const early = await fetch(`${ctx.pubUrl}/api/track/${encodeURIComponent('TAL-AAAAA-BBBBB')}`);
        assert.equal(early.status, 404);

        // admin accepts -> code
        const acc = await fetch(`${ctx.admUrl}/api/admin/orders/${order.id}/accept`, { method: 'POST', headers: adminHeaders() });
        assert.equal(acc.status, 200);
        const accepted = (await acc.json()).order;
        assert.match(accepted.tracking_code, /^TAL-/);
        assert.equal(accepted.track_url, `https://site.test/?track=${accepted.tracking_code}#track`);

        const second = await fetch(`${ctx.admUrl}/api/admin/orders/${order.id}/accept`, { method: 'POST', headers: adminHeaders() });
        assert.equal(second.status, 409);

        // visitor tracks (typed sloppily)
        const sloppy = accepted.tracking_code.toLowerCase().replace(/-/g, ' ');
        const view = await (await fetch(`${ctx.pubUrl}/api/track/${encodeURIComponent(sloppy)}`)).json();
        assert.equal(view.status, 'accepted');
        assert.equal(view.title, 'Need a website');
        assert.equal(view.clientFirstName, 'Kamal');
        const raw = JSON.stringify(view);
        for (const leak of ['0771234567', 'kamal@example.com', 'internal', 'Perera', order.id]) assert.ok(!raw.includes(leak), `leaked ${leak}`);
        assert.equal(view.timeline.length, 1); // the internal "request received" line is hidden
    } finally { await ctx.close(); }
});

test('honeypot: bots get a fake success and nothing is stored', async () => {
    const ctx = await startApps();
    try {
        const r = await fetch(`${ctx.pubUrl}/api/requests`, json({ name: 'Bot Bot', phone: '0771234567', title: 'Buy pills', consent: true, website: 'http://spam' }));
        assert.equal(r.status, 201);
        assert.equal(ctx.store._orders.length, 0);
    } finally { await ctx.close(); }
});

/* ------------------------------------------------------------------ files */
test('uploads: blocked types, oversize, forged tokens and foreign folders are rejected', async () => {
    const ctx = await startApps({ MAX_FILE_MB: '1' });
    try {
        const exe = await signAndRegister(ctx, 'virus.exe');
        assert.equal(exe.res.status, 400);
        const big = await signAndRegister(ctx, 'big.pdf', { size: 5 * 1024 * 1024 });
        assert.equal(big.res.status, 413);

        const { sign } = await signAndRegister(ctx, 'ok.pdf');
        // uploaded under a different folder than the token was issued for
        ctx.storage.put('testfolder/incoming/other/file', { bytes: 100 });
        const foreign = await fetch(`${ctx.pubUrl}/api/requests`, json({
            name: 'Kamal Perera', phone: '0771234567', title: 'Website', consent: true,
            files: [{ publicId: 'testfolder/incoming/other/file', resourceType: 'raw', folder: sign.folder, token: sign.token }]
        }));
        assert.equal(foreign.status, 400);

        // forged token
        ctx.storage.put(`${sign.folder}/f1`, { bytes: 100 });
        const forged = await fetch(`${ctx.pubUrl}/api/requests`, json({
            name: 'Kamal Perera', phone: '0771234567', title: 'Website', consent: true,
            files: [{ publicId: `${sign.folder}/f1`, resourceType: 'raw', folder: sign.folder, token: '9999999999999.AAAA' }]
        }));
        assert.equal(forged.status, 400);

        // oversize file that slipped past the browser is deleted
        ctx.storage.put(`${sign.folder}/huge`, { bytes: 3 * 1024 * 1024 });
        const huge = await fetch(`${ctx.pubUrl}/api/requests`, json({
            name: 'Kamal Perera', phone: '0771234567', title: 'Website', consent: true,
            files: [{ publicId: `${sign.folder}/huge`, resourceType: 'raw', folder: sign.folder, token: sign.token }]
        }));
        assert.equal(huge.status, 400);
        assert.ok(!ctx.storage._objects.has(`${sign.folder}/huge`));

        // executable disguised after upload
        ctx.storage.put(`${sign.folder}/payload`, { bytes: 100, originalName: 'invoice.pdf', format: 'exe' });
        const disguised = await fetch(`${ctx.pubUrl}/api/requests`, json({
            name: 'Kamal Perera', phone: '0771234567', title: 'Website', consent: true,
            files: [{ publicId: `${sign.folder}/payload`, resourceType: 'raw', folder: sign.folder, token: sign.token }]
        }));
        assert.equal(disguised.status, 400);
        assert.equal(ctx.store._orders.length, 0);
    } finally { await ctx.close(); }
});

test('tracked work: client sends more files, admin delivers files, client downloads only deliverables', async () => {
    const ctx = await startApps();
    try {
        const created = await fetch(`${ctx.admUrl}/api/admin/orders`, json({
            name: 'Nimali Silva', phone: '0712345678', title: 'Mobile app', source: 'whatsapp', issueCode: true
        }, adminHeaders()));
        assert.equal(created.status, 201);
        const order = (await created.json()).order;
        const code = order.tracking_code;
        assert.ok(code);

        // client uploads extra file using the code
        const { res, sign } = await signAndRegister(ctx, 'data.xlsx', { code });
        assert.equal(res.status, 200);
        assert.equal(sign.folder, `testfolder/orders/${code}/client`);
        ctx.storage.put(`${sign.folder}/data_1`, { bytes: 4000, originalName: 'data', format: 'xlsx' });
        const add = await fetch(`${ctx.pubUrl}/api/track/${code}/files`, json({
            files: [{ publicId: `${sign.folder}/data_1`, resourceType: 'raw', folder: sign.folder, token: sign.token }]
        }));
        assert.equal(add.status, 201);

        // a token for ANOTHER order's folder cannot be used here
        const other = await fetch(`${ctx.admUrl}/api/admin/orders`, json({ name: 'Other Client', phone: '0712345679', title: 'Other job', issueCode: true }, adminHeaders()));
        const otherCode = (await other.json()).order.tracking_code;
        const otherSign = await (await fetch(`${ctx.pubUrl}/api/uploads/sign`, json({ fileName: 'x.pdf', size: 10, code: otherCode }))).json();
        ctx.storage.put(`${otherSign.folder}/x_1`, { bytes: 10 });
        const cross = await fetch(`${ctx.pubUrl}/api/track/${code}/files`, json({
            files: [{ publicId: `${otherSign.folder}/x_1`, resourceType: 'raw', folder: otherSign.folder, token: otherSign.token }]
        }));
        assert.equal(cross.status, 400);

        // admin delivers a file
        const dsign = await (await fetch(`${ctx.admUrl}/api/admin/uploads/sign`, json({ fileName: 'final.zip', size: 500 }, adminHeaders()))).json();
        ctx.storage.put(`${dsign.folder}/ab12cd34_final.zip`, { bytes: 500, originalName: 'final', format: 'zip' });
        const reg = await fetch(`${ctx.admUrl}/api/admin/orders/${order.id}/files`, json({
            files: [{ publicId: `${dsign.folder}/ab12cd34_final.zip`, resourceType: 'raw', folder: dsign.folder, token: dsign.token }]
        }, adminHeaders()));
        assert.equal(reg.status, 201);

        const view = await (await fetch(`${ctx.pubUrl}/api/track/${code}`)).json();
        assert.equal(view.deliverables.length, 1);
        assert.equal(view.deliverables[0].name, 'final.zip');

        const dl = await fetch(`${ctx.pubUrl}/api/track/${code}/files/${view.deliverables[0].id}`, { redirect: 'manual' });
        assert.equal(dl.status, 302);
        assert.match(dl.headers.get('location'), /^https:\/\/dl\.test\//);

        // client uploads are NOT downloadable by the visitor route
        const clientFile = ctx.store._files.find((f) => f.visibility === 'client_upload');
        const sneaky = await fetch(`${ctx.pubUrl}/api/track/${code}/files/${clientFile.id}`, { redirect: 'manual' });
        assert.equal(sneaky.status, 404);
        // a deliverable cannot be fetched through another order's code
        const wrongOrder = await fetch(`${ctx.pubUrl}/api/track/${otherCode}/files/${view.deliverables[0].id}`, { redirect: 'manual' });
        assert.equal(wrongOrder.status, 404);
    } finally { await ctx.close(); }
});

/* ------------------------------------------------------------------ admin security */
test('admin API: needs a valid token, allow-listed confirmed e-mail and MFA', async () => {
    const ctx = await startApps();
    try {
        const url = `${ctx.admUrl}/api/admin/orders`;
        assert.equal((await fetch(url)).status, 401);
        assert.equal((await fetch(url, { headers: adminHeaders('garbage') })).status, 401);
        assert.equal((await fetch(url, { headers: { Authorization: 'Basic abc' } })).status, 401);
        assert.equal((await fetch(url, { headers: adminHeaders('stranger') })).status, 403);
        assert.equal((await fetch(url, { headers: adminHeaders('admin-unconfirmed') })).status, 403);
        const noMfa = await fetch(url, { headers: adminHeaders('admin-aal1') });
        assert.equal(noMfa.status, 403);
        assert.equal((await noMfa.json()).error, 'mfa_required');
        assert.equal((await fetch(url, { headers: adminHeaders('admin-ok') })).status, 200); // allow-list is case-insensitive
        assert.ok(ctx.store._audit.some((a) => a.action === 'admin.denied'));

        // the admin routes do not exist on the public server at all
        assert.equal((await fetch(`${ctx.pubUrl}/api/admin/orders`, { headers: adminHeaders('admin-ok') })).status, 404);
    } finally { await ctx.close(); }
});

test('admin server: secure headers, noindex, and no access to server files', async () => {
    const ctx = await startApps();
    try {
        const page = await fetch(`${ctx.admUrl}/`);
        assert.equal(page.status, 200);
        assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
        assert.doesNotMatch(page.headers.get('content-security-policy'), /unsafe-inline/);
        assert.match(page.headers.get('x-robots-tag'), /noindex/);
        assert.equal(page.headers.get('cache-control'), 'no-store');
        for (const p of ['/.env', '/server/config.js', '/package.json', '/../.env']) {
            assert.equal((await fetch(ctx.admUrl + p)).status, 404, p);
        }
        const cfgJs = await (await fetch(`${ctx.admUrl}/config.js`)).text();
        assert.ok(cfgJs.includes('supabaseAnonKey'));
        assert.ok(!cfgJs.includes('serviceRole'));
    } finally { await ctx.close(); }
});

test('MFA can be switched off for local development only via config', async () => {
    const ctx = await startApps({ ADMIN_REQUIRE_MFA: 'false' });
    try {
        const r = await fetch(`${ctx.admUrl}/api/admin/orders`, { headers: adminHeaders('admin-aal1') });
        assert.equal(r.status, 200);
    } finally { await ctx.close(); }
});

/* ------------------------------------------------------------------ status updates */
test('status updates: validation, private notes, visibility and completion', async () => {
    const ctx = await startApps();
    try {
        const order = (await (await fetch(`${ctx.admUrl}/api/admin/orders`, json({ name: 'Nimali Silva', phone: '0712345678', title: 'Mobile app', issueCode: true }, adminHeaders()))).json()).order;
        const post = (body) => fetch(`${ctx.admUrl}/api/admin/orders/${order.id}/updates`, json(body, adminHeaders()));

        assert.equal((await post({})).status, 400);
        assert.equal((await post({ status: 'hacked' })).status, 400);
        assert.equal((await post({ progress: 150 })).status, 400);
        assert.equal((await post({ status: 'pending_review' })).status, 400);

        assert.equal((await post({ status: 'in_progress', progress: 40, message: 'Design finished' })).status, 201);
        assert.equal((await post({ message: 'Client is slow to reply, remind on Friday', isPublic: false })).status, 201);
        assert.equal((await post({ status: 'completed' })).status, 201);

        const view = await (await fetch(`${ctx.pubUrl}/api/track/${order.tracking_code}`)).json();
        assert.equal(view.status, 'completed');
        assert.equal(view.progress, 100);
        assert.ok(!JSON.stringify(view).includes('remind on Friday'));
        assert.ok(view.timeline.some((t) => t.message === 'Design finished'));

        const detail = await (await fetch(`${ctx.admUrl}/api/admin/orders/${order.id}`, { headers: adminHeaders() })).json();
        assert.ok(detail.updates.some((u) => u.message.includes('remind on Friday')));
        assert.ok(ctx.store._audit.some((a) => a.action === 'order.updated'));

        // pending requests (no code) cannot receive public updates
        const pending = await ctx.store.createOrder({ client_name: 'No Code', client_phone: '0711111111', title: 'Pending job', status: 'pending_review', progress: 0 });
        const r = await fetch(`${ctx.admUrl}/api/admin/orders/${pending.id}/updates`, json({ message: 'hi' }, adminHeaders()));
        assert.equal(r.status, 409);
    } finally { await ctx.close(); }
});

test('regenerating a code kills the old one; rejecting never issues a code', async () => {
    const ctx = await startApps();
    try {
        const order = (await (await fetch(`${ctx.admUrl}/api/admin/orders`, json({ name: 'Nimali Silva', phone: '0712345678', title: 'Mobile app', issueCode: true }, adminHeaders()))).json()).order;
        const oldCode = order.tracking_code;
        const regen = await (await fetch(`${ctx.admUrl}/api/admin/orders/${order.id}/regenerate-code`, { method: 'POST', headers: adminHeaders() })).json();
        assert.notEqual(regen.order.tracking_code, oldCode);
        assert.equal((await fetch(`${ctx.pubUrl}/api/track/${oldCode}`)).status, 404);
        assert.equal((await fetch(`${ctx.pubUrl}/api/track/${regen.order.tracking_code}`)).status, 200);

        const pending = await ctx.store.createOrder({ client_name: 'Some One', client_phone: '0711111111', title: 'Pending job', status: 'pending_review', progress: 0 });
        const rej = await fetch(`${ctx.admUrl}/api/admin/orders/${pending.id}/reject`, json({ reason: 'Out of scope' }, adminHeaders()));
        assert.equal(rej.status, 200);
        assert.equal(ctx.store._orders.find((o) => o.id === pending.id).tracking_code, null);
        const again = await fetch(`${ctx.admUrl}/api/admin/orders/${pending.id}/accept`, { method: 'POST', headers: adminHeaders() });
        assert.equal(again.status, 409);
    } finally { await ctx.close(); }
});

test('deleting an order removes its files from storage', async () => {
    const ctx = await startApps();
    try {
        const order = (await (await fetch(`${ctx.admUrl}/api/admin/orders`, json({ name: 'Nimali Silva', phone: '0712345678', title: 'Mobile app', issueCode: true }, adminHeaders()))).json()).order;
        ctx.storage.put('testfolder/orders/x/client/a', { bytes: 10 });
        await ctx.store.addFiles([{ order_id: order.id, public_id: 'testfolder/orders/x/client/a', resource_type: 'raw', format: 'pdf', bytes: 10, original_name: 'a.pdf', visibility: 'client_upload', uploaded_by: 'client' }]);
        const del = await fetch(`${ctx.admUrl}/api/admin/orders/${order.id}`, { method: 'DELETE', headers: adminHeaders() });
        assert.equal(del.status, 200);
        assert.ok(!ctx.storage._objects.has('testfolder/orders/x/client/a'));
        assert.equal((await fetch(`${ctx.pubUrl}/api/track/${order.tracking_code}`)).status, 404);
    } finally { await ctx.close(); }
});

/* ------------------------------------------------------------------ realtime + abuse */
test('live stream: admin update notifies the visitor immediately', async () => {
    const ctx = await startApps();
    try {
        const order = (await (await fetch(`${ctx.admUrl}/api/admin/orders`, json({ name: 'Nimali Silva', phone: '0712345678', title: 'Mobile app', issueCode: true }, adminHeaders()))).json()).order;
        const controller = new AbortController();
        const res = await fetch(`${ctx.pubUrl}/api/track/${order.tracking_code}/stream`, { signal: controller.signal });
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type'), /text\/event-stream/);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let received = '';
        const readUntil = async (needle) => {
            const deadline = Date.now() + 4000;
            while (!received.includes(needle) && Date.now() < deadline) {
                const { value, done } = await reader.read();
                if (done) break;
                received += decoder.decode(value);
            }
        };
        await readUntil('event: ready');
        assert.ok(received.includes('event: ready'));
        await fetch(`${ctx.admUrl}/api/admin/orders/${order.id}/updates`, json({ status: 'in_progress', progress: 10, message: 'Started' }, adminHeaders()));
        await readUntil('event: change');
        assert.ok(received.includes('event: change'));
        controller.abort();
    } finally { await ctx.close(); }
});

test('live stream: limited number of open connections per IP; unknown code gets 404', async () => {
    const ctx = await startApps({ MAX_STREAMS_PER_IP: '2' });
    try {
        const order = (await (await fetch(`${ctx.admUrl}/api/admin/orders`, json({ name: 'Nimali Silva', phone: '0712345678', title: 'Mobile app', issueCode: true }, adminHeaders()))).json()).order;
        const controllers = [];
        const statuses = [];
        for (let i = 0; i < 3; i += 1) {
            const c = new AbortController(); controllers.push(c);
            const r = await fetch(`${ctx.pubUrl}/api/track/${order.tracking_code}/stream`, { signal: c.signal });
            statuses.push(r.status);
        }
        assert.deepEqual(statuses, [200, 200, 429]);
        controllers.forEach((c) => c.abort());
        assert.equal((await fetch(`${ctx.pubUrl}/api/track/TAL-AAAAA-BBBBB/stream`)).status, 404);
    } finally { await ctx.close(); }
});

test('rate limits protect tracking-code guessing and request spam', async () => {
    const ctx = await startApps({ RATE_TRACK_PER_MIN: '5', RATE_SUBMIT_PER_HOUR: '2' });
    try {
        const codes = [];
        for (let i = 0; i < 8; i += 1) codes.push((await fetch(`${ctx.pubUrl}/api/track/TAL-AAAAA-BBBB${i + 2}`)).status);
        assert.deepEqual(codes.slice(0, 5), [404, 404, 404, 404, 404]);
        assert.ok(codes.slice(5).every((s) => s === 429), JSON.stringify(codes));

        const statuses = [];
        for (let i = 0; i < 4; i += 1) {
            statuses.push((await fetch(`${ctx.pubUrl}/api/requests`, json({ name: 'Kamal Perera', phone: '0771234567', title: 'Website', consent: true }))).status);
        }
        assert.deepEqual(statuses, [201, 201, 429, 429]);
    } finally { await ctx.close(); }
});

test('malformed input never crashes the server or leaks internals', async () => {
    const ctx = await startApps();
    try {
        const bad = await fetch(`${ctx.pubUrl}/api/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
        assert.equal(bad.status, 400);
        const huge = await fetch(`${ctx.pubUrl}/api/requests`, json({ name: 'x'.repeat(100000), consent: true }));
        assert.equal(huge.status, 413);
        const xss = await fetch(`${ctx.pubUrl}/api/requests`, json({ name: '<img src=x onerror=alert(1)>', phone: '0771234567', title: 'Website job', consent: true }));
        assert.equal(xss.status, 201); // stored as plain text; the pages render it with textContent
        assert.equal((await fetch(`${ctx.admUrl}/api/admin/orders/not-a-uuid`, { headers: adminHeaders() })).status, 400);
        assert.equal((await fetch(`${ctx.pubUrl}/api/track/%00%00`)).status, 404);
    } finally { await ctx.close(); }
});

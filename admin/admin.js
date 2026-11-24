/**
 * Admin dashboard (runs only on the separate admin server).
 * - Sign-in with Supabase Auth, then mandatory TOTP two-factor when the server requires it.
 * - Every API call carries the Supabase access token; the SERVER decides who is an admin.
 * - All data is inserted with textContent (never innerHTML) so client-supplied text cannot run code.
 */
(function () {
    'use strict';

    const CFG = window.__ADMIN_CONFIG__ || {};
    const $ = (sel, root) => (root || document).querySelector(sel);

    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storage: window.sessionStorage // session ends when the browser tab/window closes
        }
    });

    const STATUS_LABEL = {
        pending_review: 'Waiting for review', accepted: 'Accepted', in_progress: 'In progress',
        awaiting_client: 'Waiting for client', ready_for_delivery: 'Ready for delivery', completed: 'Completed',
        on_hold: 'On hold', cancelled: 'Cancelled', rejected: 'Declined'
    };

    const state = { me: null, statuses: [], orders: [], selected: null, timer: null, mfa: null };

    /* ---------- helpers ---------- */
    function h(tag, props) {
        const el = document.createElement(tag);
        Object.keys(props || {}).forEach((k) => {
            if (k === 'class') el.className = props[k];
            else if (k === 'text') el.textContent = props[k];
            else if (k === 'value') el.value = props[k];
            else if (k.startsWith('on')) el.addEventListener(k.slice(2), props[k]);
            else el.setAttribute(k, props[k]);
        });
        const append = (c) => {
            if (c == null || c === false) return;
            if (Array.isArray(c)) { c.forEach(append); return; }
            el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        };
        for (let i = 2; i < arguments.length; i += 1) append(arguments[i]);
        return el;
    }

    const fmtDate = (iso, withTime) => {
        const d = new Date(iso);
        if (isNaN(d)) return '';
        return d.toLocaleString('en-GB', withTime
            ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
            : { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const fmtBytes = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
    const money = (n) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-US');

    function show(view) {
        ['login', 'mfa', 'denied', 'dash'].forEach((v) => { $('#view-' + v).hidden = v !== view; });
        if (view !== 'dash') stopTimer();
    }

    let toastTimer = null;
    function toast(text, isError) {
        const el = $('#toast');
        el.textContent = text;
        el.className = 'toast show' + (isError ? ' err' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.className = 'toast'; }, 3500);
    }

    async function api(method, path, body) {
        const { data } = await sb.auth.getSession();
        const token = data && data.session && data.session.access_token;
        if (!token) { show('login'); throw new Error('Signed out'); }
        const res = await fetch(path, {
            method,
            headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
            body: body ? JSON.stringify(body) : undefined
        });
        let json = null;
        try { json = await res.json(); } catch (e) { /* ignore */ }
        if (res.status === 401) { await sb.auth.signOut(); show('login'); throw new Error('Session expired. Please sign in again.'); }
        if (res.status === 403 && json && json.error === 'mfa_required') { startMfa(); throw new Error('Two-factor authentication required.'); }
        if (res.status === 403) { show('denied'); throw new Error('Access denied'); }
        if (!res.ok) throw new Error((json && json.error) || 'Request failed');
        return json;
    }

    /* ---------- authentication ---------- */
    async function afterAuth() {
        const { data } = await sb.auth.getSession();
        if (!data || !data.session) return show('login');

        if (CFG.requireMfa) {
            const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
            if (!aal || aal.currentLevel !== 'aal2') return startMfa();
        }
        try {
            state.me = await api('GET', '/api/admin/me');
        } catch (e) {
            return; // api() already switched to the right screen
        }
        state.statuses = state.me.statuses;
        $('#who').textContent = state.me.email;
        const filter = $('#filter-status');
        filter.textContent = '';
        filter.appendChild(h('option', { value: '', text: 'All statuses' }));
        state.statuses.forEach((s) => filter.appendChild(h('option', { value: s, text: STATUS_LABEL[s] || s })));
        show('dash');
        await loadOrders();
        startTimer();
    }

    async function startMfa() {
        show('mfa');
        const msg = $('#mfa-msg');
        msg.textContent = '';
        $('#mfa-code').value = '';
        const { data, error } = await sb.auth.mfa.listFactors();
        if (error) { msg.textContent = error.message; return; }
        const verified = (data.totp || []).find((f) => f.status === 'verified');

        if (verified) {
            state.mfa = { factorId: verified.id };
            $('#mfa-enroll').hidden = true;
            $('#mfa-challenge-text').hidden = false;
            $('#mfa-title').textContent = 'Two-factor authentication';
            return;
        }
        // First time: remove half-finished enrolments, then create a new authenticator
        for (const f of (data.all || []).filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
            await sb.auth.mfa.unenroll({ factorId: f.id });
        }
        const enrolled = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Admin ' + new Date().toISOString().slice(0, 10) + '-' + Math.floor(Math.random() * 1e4) });
        if (enrolled.error) { msg.textContent = enrolled.error.message; return; }
        state.mfa = { factorId: enrolled.data.id };
        $('#mfa-qr').src = enrolled.data.totp.qr_code;
        $('#mfa-secret').textContent = enrolled.data.totp.secret;
        $('#mfa-enroll').hidden = false;
        $('#mfa-challenge-text').hidden = true;
        $('#mfa-title').textContent = 'Set up two-factor authentication';
    }

    function initAuthForms() {
        $('#login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = $('#login-submit');
            const msg = $('#login-msg');
            btn.disabled = true;
            msg.textContent = '';
            const { error } = await sb.auth.signInWithPassword({
                email: $('#login-email').value.trim(),
                password: $('#login-password').value
            });
            btn.disabled = false;
            $('#login-password').value = '';
            if (error) { msg.textContent = 'Sign in failed. Check your e-mail and password.'; return; }
            afterAuth();
        });

        $('#mfa-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = $('#mfa-submit');
            const msg = $('#mfa-msg');
            btn.disabled = true;
            msg.textContent = '';
            const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: state.mfa.factorId, code: $('#mfa-code').value.trim() });
            btn.disabled = false;
            if (error) { msg.textContent = 'That code was not accepted. Try the newest code.'; $('#mfa-code').value = ''; return; }
            afterAuth();
        });

        const signOut = async () => { await sb.auth.signOut(); state.selected = null; show('login'); };
        $('#mfa-cancel').addEventListener('click', signOut);
        $('#denied-signout').addEventListener('click', signOut);
        $('#btn-signout').addEventListener('click', signOut);
    }

    /* ---------- order list ---------- */
    function startTimer() {
        stopTimer();
        // New requests and changes made elsewhere show up without reloading
        state.timer = setInterval(() => {
            if (document.hidden) return;
            loadOrders(true);
            const detail = $('#detail');
            if (state.selected && !detail.contains(document.activeElement)) openOrder(state.selected, true);
        }, 15000);
    }
    function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }

    async function loadOrders(silent) {
        try {
            const qs = new URLSearchParams();
            const status = $('#filter-status').value;
            const q = $('#search').value.trim();
            if (status) qs.set('status', status);
            if (q) qs.set('q', q);
            const data = await api('GET', '/api/admin/orders?' + qs.toString());
            state.orders = data.orders;
            renderList();
        } catch (e) {
            if (!silent) toast(e.message, true);
        }
    }

    function renderList() {
        const ul = $('#order-list');
        ul.textContent = '';
        $('#list-empty').hidden = state.orders.length > 0;
        state.orders.forEach((o) => {
            ul.appendChild(h('li', {},
                h('button', { type: 'button', class: 'order-item' + (o.id === state.selected ? ' active' : ''), onclick: () => openOrder(o.id) },
                    h('div', { class: 't', text: o.title }),
                    h('div', { class: 's' },
                        h('span', { class: 'chip ' + o.status, text: STATUS_LABEL[o.status] || o.status }),
                        h('span', { text: o.client_name }),
                        h('span', { text: o.tracking_code || 'no code yet' }),
                        h('span', { text: fmtDate(o.updated_at) })))));
        });
    }

    /* ---------- order detail ---------- */
    function whatsappLink(order, message) {
        let digits = String(order.client_phone || '').replace(/\D/g, '');
        if (!digits) return null;
        if (digits.startsWith('0')) digits = '94' + digits.slice(1); // Sri Lankan local format
        return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(message);
    }

    function clientMessage(order) {
        const first = String(order.client_name || '').split(/\s+/)[0] || 'there';
        const link = order.track_url || (CFG.publicBaseUrl ? CFG.publicBaseUrl + '/?track=' + order.tracking_code + '#track' : '');
        return 'Hi ' + first + ', your work "' + order.title + '" has been accepted.\n\n' +
            'Tracking code: ' + order.tracking_code + '\n' +
            (link ? 'Follow progress live: ' + link + '\n' : '') +
            '\nThank you for choosing TechAssist LK.';
    }

    async function copy(text, label) {
        try { await navigator.clipboard.writeText(text); toast((label || 'Text') + ' copied'); }
        catch (e) { toast('Could not copy', true); }
    }

    async function act(fn, success) {
        try { await fn(); if (success) toast(success); } catch (e) { toast(e.message, true); }
    }

    async function openOrder(id, silent) {
        try {
            const data = await api('GET', '/api/admin/orders/' + encodeURIComponent(id));
            state.selected = id;
            renderDetail(data);
            renderList();
        } catch (e) {
            if (!silent) toast(e.message, true);
        }
    }

    function refreshAll(id) {
        return Promise.all([loadOrders(true), openOrder(id || state.selected, true)]);
    }

    function renderDetail({ order, updates, files }) {
        const root = $('#detail');
        root.textContent = '';

        /* header + actions */
        const actions = h('div', { class: 'row' });
        if (!order.tracking_code && order.status === 'pending_review') {
            actions.append(
                h('button', { type: 'button', class: 'btn primary', onclick: () => act(async () => {
                    await api('POST', '/api/admin/orders/' + order.id + '/accept');
                    await refreshAll(order.id);
                }, 'Accepted. Tracking code created.') }, 'Accept & issue tracking code'),
                h('button', { type: 'button', class: 'btn danger', onclick: () => {
                    const reason = window.prompt('Reason for declining (kept private):', '');
                    if (reason === null) return;
                    act(async () => { await api('POST', '/api/admin/orders/' + order.id + '/reject', { reason }); await refreshAll(order.id); }, 'Request declined');
                } }, 'Decline'));
        }
        if (order.tracking_code) {
            const msg = clientMessage(order);
            const wa = whatsappLink(order, msg);
            actions.append(
                h('span', { class: 'code', text: order.tracking_code }),
                h('button', { type: 'button', class: 'btn small', onclick: () => copy(order.tracking_code, 'Code') }, 'Copy code'),
                h('button', { type: 'button', class: 'btn small', onclick: () => copy(msg, 'Message') }, 'Copy client message'),
                wa ? h('a', { class: 'btn small', href: wa, target: '_blank', rel: 'noopener noreferrer' }, 'Send via WhatsApp') : null,
                h('button', { type: 'button', class: 'btn small danger', onclick: () => {
                    if (!window.confirm('Create a new code? The old code stops working immediately.')) return;
                    act(async () => { await api('POST', '/api/admin/orders/' + order.id + '/regenerate-code'); await refreshAll(order.id); }, 'New code created');
                } }, 'New code'));
        }

        root.append(h('div', { class: 'panel' },
            h('div', { class: 'row' }, h('h2', { text: order.title }), h('span', { class: 'chip ' + order.status, text: STATUS_LABEL[order.status] || order.status })),
            h('p', { class: 'muted small', text: 'Reference REQ-' + String(order.id).slice(0, 8).toUpperCase() + ' · from ' + order.source + ' · created ' + fmtDate(order.created_at, true) }),
            actions));

        /* client */
        const kv = h('dl', { class: 'kv' });
        const add = (k, v) => { if (v) kv.append(h('dt', { text: k }), h('dd', { text: v })); };
        add('Client', order.client_name);
        add('School / company', order.client_org);
        add('Phone', order.client_phone);
        add('E-mail', order.client_email);
        add('Details', order.details);
        add('Quotation', order.quote_no ? order.quote_no + (order.quote_total != null ? ' · ' + money(order.quote_total) : '') : '');
        if (Array.isArray(order.quote_lines)) {
            add('Quoted items', order.quote_lines.map((l) => l.name + ' x' + l.qty + (l.amount != null ? ' = ' + money(l.amount) : ' (TBQ)')).join('\n'));
        }
        const notes = h('textarea', { maxlength: '4000', 'aria-label': 'Internal notes', value: order.internal_notes || '' });
        root.append(h('div', { class: 'panel' }, h('h3', { text: 'Client' }), kv,
            h('label', { text: 'Internal notes (never shown to the client)' }), notes,
            h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn small', onclick: () => act(async () => {
                await api('PATCH', '/api/admin/orders/' + order.id, { internalNotes: notes.value });
                await refreshAll(order.id);
            }, 'Notes saved') }, 'Save notes'))));

        /* post update */
        if (!['rejected'].includes(order.status)) {
            const status = h('select', { 'aria-label': 'Status' });
            status.appendChild(h('option', { value: '', text: '(keep current: ' + (STATUS_LABEL[order.status] || order.status) + ')' }));
            state.statuses.filter((s) => s !== 'pending_review' && s !== 'rejected').forEach((s) => status.appendChild(h('option', { value: s, text: STATUS_LABEL[s] })));
            const progressNum = h('input', { type: 'number', min: '0', max: '100', step: '5', 'aria-label': 'Progress percent', value: String(order.progress) });
            const progress = h('input', { type: 'range', min: '0', max: '100', step: '5', 'aria-label': 'Progress', value: String(order.progress) });
            progress.addEventListener('input', () => { progressNum.value = progress.value; });
            progressNum.addEventListener('input', () => { progress.value = progressNum.value; });
            const message = h('textarea', { maxlength: '1000', placeholder: 'What happened? This is what the client reads.' });
            const isPublic = h('input', { type: 'checkbox', checked: 'checked', id: 'upd-public' });
            const dueEdit = h('input', { type: 'date', 'aria-label': 'Expected by', value: order.due_date || '' });
            const canPublic = !!order.tracking_code;
            if (!canPublic) { isPublic.checked = false; isPublic.disabled = true; }

            root.append(h('div', { class: 'panel' }, h('h3', { text: 'Post an update' }),
                h('div', { class: 'grid2' },
                    h('div', {}, h('label', { text: 'Status' }), status),
                    h('div', {}, h('label', { text: 'Expected by' }), dueEdit)),
                h('label', { text: 'Progress' }), h('div', { class: 'range-row' }, progress, progressNum),
                h('label', { text: 'Message' }), message,
                h('label', { class: 'check' }, isPublic, 'Show to the client on the tracking page' + (canPublic ? '' : ' (accept the request first)')),
                h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn primary', onclick: () => act(async () => {
                    const body = { isPublic: isPublic.checked, message: message.value };
                    if (status.value) body.status = status.value;
                    const p = parseInt(progressNum.value, 10);
                    if (Number.isFinite(p) && p !== order.progress) body.progress = p;
                    if ((dueEdit.value || null) !== (order.due_date || null)) body.dueDate = dueEdit.value || null;
                    await api('POST', '/api/admin/orders/' + order.id + '/updates', body);
                    await refreshAll(order.id);
                }, 'Update posted') }, 'Post update'))));
        }

        /* files */
        const clientFiles = files.filter((f) => f.visibility === 'client_upload');
        const deliverables = files.filter((f) => f.visibility === 'deliverable');
        const fileList = (list) => h('ul', { class: 'files' }, list.length ? list.map((f) => h('li', {},
            h('span', { class: 'n', text: f.original_name }),
            h('span', { class: 'z', text: fmtBytes(f.bytes) }),
            h('button', { type: 'button', class: 'btn small', onclick: () => act(async () => {
                const r = await api('GET', '/api/admin/files/' + f.id + '/download');
                window.open(r.url, '_blank', 'noopener,noreferrer');
            }) }, 'Download'))) : [h('li', { class: 'muted', text: 'None' })]);

        const picker = h('input', { type: 'file', multiple: 'multiple', 'aria-label': 'Choose files to deliver' });
        root.append(h('div', { class: 'panel' },
            h('h3', { text: 'Files from the client' }), fileList(clientFiles),
            h('h3', { text: 'Files for the client (downloadable on their tracking page)' }), fileList(deliverables),
            h('div', { class: 'row' }, picker,
                h('button', { type: 'button', class: 'btn small primary', onclick: () => act(async () => {
                    if (!picker.files.length) throw new Error('Choose at least one file');
                    const descriptors = [];
                    let session = {};
                    for (const file of Array.from(picker.files)) {
                        const sign = await api('POST', '/api/admin/uploads/sign', { fileName: file.name, size: file.size, folder: session.folder, token: session.token });
                        session = { folder: sign.folder, token: sign.token };
                        const fd = new FormData();
                        Object.keys(sign.fields).forEach((k) => fd.append(k, sign.fields[k]));
                        fd.append('file', file);
                        const res = await fetch(sign.uploadUrl, { method: 'POST', body: fd });
                        const out = await res.json();
                        if (!res.ok || !out.public_id) throw new Error((out.error && out.error.message) || 'Upload failed');
                        descriptors.push({ publicId: out.public_id, resourceType: out.resource_type, folder: sign.folder, token: sign.token });
                    }
                    await api('POST', '/api/admin/orders/' + order.id + '/files', { files: descriptors });
                    await refreshAll(order.id);
                }, 'Files uploaded') }, 'Upload for client'))));

        /* timeline */
        root.append(h('div', { class: 'panel' }, h('h3', { text: 'Timeline' }),
            h('ul', { class: 'timeline' }, updates.map((u) => h('li', {},
                h('div', { class: 'meta' },
                    h('strong', { text: STATUS_LABEL[u.status] || u.status }),
                    h('span', { text: u.progress + '%' }),
                    h('span', { text: fmtDate(u.created_at, true) }),
                    h('span', { text: u.created_by }),
                    u.is_public ? h('span', { text: 'visible to client' }) : h('span', { class: 'internal', text: 'internal' })),
                u.message ? h('p', { text: u.message }) : null)))));

        /* danger zone */
        root.append(h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn danger small', onclick: () => {
            if (!window.confirm('Delete this order and ALL its files permanently? This cannot be undone.')) return;
            act(async () => {
                await api('DELETE', '/api/admin/orders/' + order.id);
                state.selected = null;
                $('#detail').textContent = '';
                $('#detail').appendChild(h('p', { class: 'muted pad', text: 'Order deleted.' }));
                await loadOrders(true);
            }, 'Order deleted');
        } }, 'Delete order')));
    }

    /* ---------- dialogs ---------- */
    function initDialogs() {
        const dlgNew = $('#dlg-new');
        $('#btn-new').addEventListener('click', () => { $('#new-form').reset(); $('#new-msg').textContent = ''; dlgNew.showModal(); });
        $('#new-cancel').addEventListener('click', () => dlgNew.close());
        $('#new-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = $('#new-msg');
            msg.textContent = '';
            const body = {
                name: $('#n-name').value, org: $('#n-org').value, phone: $('#n-phone').value, email: $('#n-email').value,
                title: $('#n-title').value, details: $('#n-details').value, source: $('#n-source').value,
                quoteNo: $('#n-quoteno').value, internalNotes: $('#n-notes').value, issueCode: $('#n-issue').checked
            };
            if ($('#n-due').value) body.dueDate = $('#n-due').value;
            if ($('#n-quotetotal').value !== '') body.quoteTotal = Number($('#n-quotetotal').value);
            const btn = $('#new-submit');
            btn.disabled = true;
            try {
                const r = await api('POST', '/api/admin/orders', body);
                dlgNew.close();
                await loadOrders(true);
                await openOrder(r.order.id);
                toast(r.order.tracking_code ? 'Created. Tracking code: ' + r.order.tracking_code : 'Order created');
            } catch (err) {
                msg.textContent = err.message;
            } finally {
                btn.disabled = false;
            }
        });

        const dlgAudit = $('#dlg-audit');
        $('#audit-close').addEventListener('click', () => dlgAudit.close());
        $('#btn-audit').addEventListener('click', () => act(async () => {
            const data = await api('GET', '/api/admin/audit');
            const body = $('#audit-body');
            body.textContent = '';
            const table = h('table', {}, h('thead', {}, h('tr', {}, ...['When', 'Who', 'Action', 'IP'].map((t) => h('th', { text: t })))),
                h('tbody', {}, data.entries.map((a) => h('tr', {},
                    h('td', { text: fmtDate(a.at, true) }), h('td', { text: a.actor }), h('td', { text: a.action }), h('td', { text: a.ip || '' })))));
            body.appendChild(table);
            dlgAudit.showModal();
        }));
    }

    /* ---------- boot ---------- */
    function init() {
        initAuthForms();
        initDialogs();
        $('#btn-refresh').addEventListener('click', () => { loadOrders(); if (state.selected) openOrder(state.selected, true); });
        let t = null;
        $('#search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadOrders, 300); });
        $('#filter-status').addEventListener('change', () => loadOrders());
        afterAuth();
    }

    init();
})();

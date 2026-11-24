/**
 * Visitor side of the work tracking system:
 *   - "Track my work": enter a tracking code, see status + timeline LIVE (Server-Sent Events,
 *     with a slow polling safety net), download finished files, send more files.
 *   - "Send a request": submit a request with files (PDF, Excel, TXT, any relevant format)
 *     and optionally the quotation built above.
 *
 * Files go straight from the browser to Cloudinary using a short-lived signature issued by
 * the server. No secret key exists in this file. Settings come from /config.js (built from .env).
 * All text coming from the server is inserted with textContent, never as HTML.
 */
(function () {
    'use strict';

    const CFG = window.__TAL_CONFIG__ || {};
    const API = (CFG.apiBase || '').replace(/\/+$/, '');
    const MAX_FILES = CFG.maxFiles || 5;
    const MAX_MB = CFG.maxFileMb || 10;
    const MAX_BYTES = MAX_MB * 1024 * 1024;
    const BLOCKED = ['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'lnk', 'hta', 'vbs', 'vbe', 'wsf', 'ps1', 'psm1',
        'sh', 'bash', 'dll', 'sys', 'jar', 'app', 'dmg', 'reg', 'cpl', 'msc', 'apk'];

    const STATUS_LABEL = {
        pending_review: 'Waiting for review',
        accepted: 'Accepted',
        in_progress: 'In progress',
        awaiting_client: 'Waiting for your reply',
        ready_for_delivery: 'Ready for delivery',
        completed: 'Completed',
        on_hold: 'On hold',
        cancelled: 'Cancelled',
        rejected: 'Declined'
    };
    const STEPS = [
        { label: 'Accepted', statuses: ['accepted'] },
        { label: 'In progress', statuses: ['in_progress', 'awaiting_client', 'on_hold'] },
        { label: 'Ready', statuses: ['ready_for_delivery'] },
        { label: 'Completed', statuses: ['completed'] }
    ];

    const $ = (sel, root) => (root || document).querySelector(sel);

    /* ---------- small helpers ---------- */
    function h(tag, props) {
        const el = document.createElement(tag);
        Object.keys(props || {}).forEach((k) => {
            if (k === 'class') el.className = props[k];
            else if (k === 'text') el.textContent = props[k];
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

    function icon(name) { return h('i', { class: 'fas ' + name, 'aria-hidden': 'true' }); }

    function fmtBytes(n) {
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
        return (n / 1048576).toFixed(1) + ' MB';
    }

    function fmtDate(iso, withTime) {
        const d = new Date(iso);
        if (isNaN(d)) return '';
        return d.toLocaleString('en-GB', withTime
            ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
            : { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function extOf(name) {
        const parts = String(name).toLowerCase().split('.').slice(1);
        return parts;
    }

    async function api(method, path, body) {
        const res = await fetch(API + path, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        });
        let data = null;
        try { data = await res.json(); } catch (e) { /* not json */ }
        if (!res.ok) {
            const err = new Error((data && data.error) || 'Something went wrong. Please try again.');
            err.status = res.status;
            throw err;
        }
        return data;
    }

    const storage = (function () {
        try {
            const k = '__t__';
            window.localStorage.setItem(k, '1');
            window.localStorage.removeItem(k);
            return window.localStorage;
        } catch (e) { return null; }
    })();

    /* ---------- direct upload to Cloudinary ---------- */
    function xhrUpload(url, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
            xhr.onerror = () => reject(new Error('Network error while uploading. Please try again.'));
            xhr.onload = () => {
                let data = null;
                try { data = JSON.parse(xhr.responseText); } catch (e) { /* ignore */ }
                if (xhr.status >= 200 && xhr.status < 300 && data && data.public_id) resolve(data);
                else reject(new Error((data && data.error && data.error.message) || 'Upload failed. Please try again.'));
            };
            xhr.send(formData);
        });
    }

    async function uploadOne(file, session, onProgress) {
        const sign = await api('POST', '/api/uploads/sign', {
            fileName: file.name,
            size: file.size,
            code: session.code || undefined,
            folder: session.folder || undefined,
            token: session.token || undefined
        });
        if (!session.code) { session.folder = sign.folder; session.token = sign.token; }
        const fd = new FormData();
        Object.keys(sign.fields).forEach((k) => fd.append(k, sign.fields[k]));
        fd.append('file', file);
        const result = await xhrUpload(sign.uploadUrl, fd, onProgress);
        return { publicId: result.public_id, resourceType: result.resource_type, folder: sign.folder, token: sign.token };
    }

    /* ---------- file picker widget ---------- */
    function createFilePicker(container, options) {
        const max = (options && options.max) || MAX_FILES;
        let items = []; // { file, row, bar }
        const input = h('input', { type: 'file', multiple: 'multiple', class: 'fp-input', 'aria-label': 'Choose files' });
        const hint = h('span', { class: 'fp-hint', text: `PDF, Excel, Word, TXT, images, ZIP or any other work-related file. Up to ${max} files, ${MAX_MB} MB each.` });
        const drop = h('label', { class: 'fp-drop' }, icon('fa-cloud-arrow-up'),
            h('strong', { text: 'Choose files or drop them here' }), hint, input);
        const list = h('ul', { class: 'fp-list' });
        const msg = h('div', { class: 'fp-msg', role: 'alert' });
        container.append(drop, list, msg);

        function say(text) { msg.textContent = text || ''; }

        function add(fileList) {
            say('');
            Array.from(fileList).forEach((file) => {
                if (items.length >= max) { say(`You can add up to ${max} files at a time.`); return; }
                if (file.size > MAX_BYTES) { say(`"${file.name}" is larger than ${MAX_MB} MB.`); return; }
                if (file.size === 0) { say(`"${file.name}" is empty.`); return; }
                if (extOf(file.name).some((x) => BLOCKED.indexOf(x) !== -1)) { say(`"${file.name}" is a file type that cannot be sent.`); return; }
                if (items.some((i) => i.file.name === file.name && i.file.size === file.size)) return;

                const bar = h('span', { class: 'fp-bar' });
                const row = h('li', { class: 'fp-item' },
                    icon('fa-file'),
                    h('span', { class: 'fp-name', text: file.name }),
                    h('span', { class: 'fp-size', text: fmtBytes(file.size) }),
                    h('span', { class: 'fp-progress' }, bar),
                    h('button', { type: 'button', class: 'fp-remove', 'aria-label': 'Remove ' + file.name, onclick: () => remove(file) }, icon('fa-xmark'))
                );
                const item = { file, row, bar };
                items.push(item);
                list.appendChild(row);
            });
            input.value = '';
        }

        function remove(file) {
            const i = items.findIndex((x) => x.file === file);
            if (i === -1) return;
            items[i].row.remove();
            items.splice(i, 1);
            say('');
        }

        input.addEventListener('change', () => add(input.files));
        ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
        ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
        drop.addEventListener('drop', (e) => { if (e.dataTransfer) add(e.dataTransfer.files); });

        return {
            count: () => items.length,
            say,
            clear() { items.forEach((i) => i.row.remove()); items = []; say(''); },
            /** Uploads every file one after another and returns the descriptors for the API. */
            async uploadAll(session) {
                const done = [];
                for (const item of items) {
                    item.row.classList.add('uploading');
                    const d = await uploadOne(item.file, session, (p) => { item.bar.style.width = Math.round(p * 100) + '%'; });
                    item.bar.style.width = '100%';
                    item.row.classList.remove('uploading');
                    item.row.classList.add('uploaded');
                    done.push(d);
                }
                return done;
            }
        };
    }

    /* ---------- tabs ---------- */
    function showTab(name) {
        ['track', 'send'].forEach((t) => {
            const pane = document.getElementById('pane-' + t);
            const btn = document.querySelector('.track-tab[data-tab="' + t + '"]');
            const on = t === name;
            if (pane) pane.hidden = !on;
            if (btn) { btn.classList.toggle('active', on); btn.setAttribute('aria-selected', String(on)); }
        });
    }

    /* ---------- TRACK ---------- */
    const track = { code: null, es: null, poll: null, view: null, busy: false, debounce: null };

    function renderResult(view) {
        track.view = view;
        const box = $('#track-result');
        box.hidden = false;

        $('#tr-title').textContent = view.title;
        $('#tr-greeting').textContent = view.clientFirstName ? 'Hi ' + view.clientFirstName + ', here is where things stand.' : 'Here is where things stand.';
        $('#tr-code').textContent = view.code;
        const badge = $('#tr-status');
        badge.textContent = STATUS_LABEL[view.status] || view.status;
        badge.className = 'tr-badge st-' + view.status;
        $('#tr-progress-bar').style.width = view.progress + '%';
        $('#tr-progress-text').textContent = view.progress + '%';
        $('#tr-progress').setAttribute('aria-valuenow', String(view.progress));
        $('#tr-due').textContent = view.dueDate ? fmtDate(view.dueDate + 'T00:00:00') : 'To be confirmed';
        $('#tr-updated').textContent = fmtDate(view.updatedAt, true);

        // steps
        const stepsEl = $('#tr-steps');
        stepsEl.textContent = '';
        const current = STEPS.findIndex((s) => s.statuses.indexOf(view.status) !== -1);
        STEPS.forEach((s, i) => {
            stepsEl.appendChild(h('li', { class: 'tr-step' + (current >= i ? ' done' : '') + (current === i ? ' current' : '') },
                h('span', { class: 'tr-step-dot' }), h('span', { text: s.label })));
        });
        stepsEl.hidden = current === -1;

        // timeline
        const tl = $('#tr-timeline');
        tl.textContent = '';
        if (!view.timeline.length) tl.appendChild(h('li', { class: 'tr-empty', text: 'No updates yet.' }));
        view.timeline.forEach((t) => {
            tl.appendChild(h('li', { class: 'tr-event' },
                h('span', { class: 'tr-event-dot' }),
                h('div', { class: 'tr-event-body' },
                    h('div', { class: 'tr-event-head' },
                        h('strong', { text: STATUS_LABEL[t.status] || t.status }),
                        h('span', { class: 'tr-event-time', text: fmtDate(t.at, true) })),
                    t.message ? h('p', { text: t.message }) : null)));
        });

        // deliverables
        const dl = $('#tr-deliverables');
        const dlWrap = $('#tr-deliverables-wrap');
        dl.textContent = '';
        dlWrap.hidden = view.deliverables.length === 0;
        view.deliverables.forEach((f) => {
            dl.appendChild(h('li', {},
                icon('fa-file-arrow-down'),
                h('span', { class: 'dl-name', text: f.name }),
                h('span', { class: 'dl-size', text: fmtBytes(f.bytes) }),
                h('a', { class: 'btn outline-btn btn-sm', href: API + '/api/track/' + encodeURIComponent(view.code) + '/files/' + encodeURIComponent(f.id), rel: 'noopener' }, 'Download')));
        });

        $('#tr-more-wrap').hidden = !view.acceptingFiles;
    }

    function setLive(state) {
        const el = $('#tr-live');
        if (!el) return;
        el.className = 'tr-live ' + state;
        el.textContent = state === 'on' ? 'Live' : (state === 'wait' ? 'Reconnecting…' : 'Auto-refresh');
    }

    function stopLive() {
        if (track.es) { track.es.close(); track.es = null; }
        if (track.poll) { clearInterval(track.poll); track.poll = null; }
        if (track.debounce) { clearTimeout(track.debounce); track.debounce = null; }
    }

    async function refresh(silent) {
        if (!track.code || track.busy) return;
        track.busy = true;
        try {
            const view = await api('GET', '/api/track/' + encodeURIComponent(track.code));
            renderResult(view);
        } catch (e) {
            if (!silent) showTrackError(e.message);
            if (e.status === 404) { stopLive(); }
        } finally {
            track.busy = false;
        }
    }

    function startLive() {
        stopLive();
        setLive('poll');
        if ('EventSource' in window) {
            try {
                const es = new EventSource(API + '/api/track/' + encodeURIComponent(track.code) + '/stream');
                track.es = es;
                es.addEventListener('ready', () => setLive('on'));
                es.addEventListener('change', () => {
                    clearTimeout(track.debounce);
                    track.debounce = setTimeout(() => refresh(true), 250);
                });
                es.onerror = () => setLive('wait'); // the browser reconnects by itself
            } catch (e) { /* polling below still works */ }
        }
        // safety net: slow polling while the tab is visible
        track.poll = setInterval(() => { if (!document.hidden) refresh(true); }, 30000);
    }

    function showTrackError(text) {
        const el = $('#track-error');
        el.textContent = text || '';
        el.hidden = !text;
    }

    async function lookup(rawCode) {
        const code = String(rawCode || '').trim();
        showTrackError('');
        if (code.length < 8) { showTrackError('Please enter your tracking code, for example TAL-7K4MQ-9XR2B.'); return; }
        const btn = $('#track-submit');
        btn.disabled = true;
        $('#track-result').hidden = true;
        stopLive();
        try {
            const view = await api('GET', '/api/track/' + encodeURIComponent(code));
            track.code = view.code;
            renderResult(view);
            if (storage) { try { storage.setItem('tal_last_code', view.code); } catch (e) { /* ignore */ } }
            $('#track-code').value = view.code;
            startLive();
        } catch (e) {
            showTrackError(e.status === 404
                ? 'We could not find that code. Please check it and try again, or message me on WhatsApp.'
                : e.message);
        } finally {
            btn.disabled = false;
        }
    }

    function initTrack() {
        const form = $('#track-form');
        if (!form) return;
        form.addEventListener('submit', (e) => { e.preventDefault(); lookup($('#track-code').value); });
        $('#track-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });

        if (storage) {
            try {
                const last = storage.getItem('tal_last_code');
                if (last) $('#track-code').value = last;
            } catch (e) { /* ignore */ }
        }

        // more files for existing work
        const moreHost = $('#tr-more-picker');
        const picker = createFilePicker(moreHost);
        $('#tr-more-send').addEventListener('click', async () => {
            if (!track.code) return;
            if (!picker.count()) { picker.say('Choose at least one file first.'); return; }
            const btn = $('#tr-more-send');
            btn.disabled = true;
            picker.say('');
            try {
                const files = await picker.uploadAll({ code: track.code });
                await api('POST', '/api/track/' + encodeURIComponent(track.code) + '/files', { files });
                picker.clear();
                picker.say('Thank you, your files were sent.');
                refresh(true);
            } catch (e) {
                picker.say(e.message);
            } finally {
                btn.disabled = false;
            }
        });

        $('#tr-copy').addEventListener('click', () => {
            const text = $('#tr-code').textContent;
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        });

        document.addEventListener('visibilitychange', () => { if (!document.hidden && track.code) refresh(true); });
    }

    /* ---------- SEND REQUEST ---------- */
    let requestPicker = null;
    let attachedQuote = null;

    function getQuote() {
        const svc = window.TechAssistServices;
        return svc && typeof svc.getQuoteSnapshot === 'function' ? svc.getQuoteSnapshot() : null;
    }

    function renderQuoteChip() {
        const chip = $('#rq-quote');
        chip.textContent = '';
        chip.hidden = !attachedQuote;
        if (!attachedQuote) return;
        chip.append(
            icon('fa-file-invoice'),
            h('span', { text: 'Quotation ' + attachedQuote.no + ' attached (Rs. ' + Math.round(attachedQuote.total).toLocaleString('en-US') + ')' }),
            h('button', { type: 'button', class: 'fp-remove', 'aria-label': 'Do not attach the quotation', onclick: () => { attachedQuote = null; renderQuoteChip(); } }, icon('fa-xmark'))
        );
    }

    function openRequestFromQuote() {
        const snap = getQuote();
        showTab('send');
        $('#request-done').hidden = true;
        $('#request-form').hidden = false;
        if (snap) {
            attachedQuote = { no: snap.no, total: snap.total, lines: snap.lines };
            const set = (id, v) => { const el = document.getElementById(id); if (el && v && !el.value) el.value = v; };
            set('rq-name', snap.client.name);
            set('rq-phone', snap.client.phone);
            set('rq-email', snap.client.email);
            set('rq-org', snap.client.org);
            const titleEl = $('#rq-title');
            if (titleEl && !titleEl.value) {
                titleEl.value = snap.lines.slice(0, 3).map((l) => l.name).join(', ').slice(0, 150);
            }
            const details = $('#rq-details');
            if (details && !details.value && snap.client.notes) details.value = snap.client.notes.slice(0, 2000);
        }
        renderQuoteChip();
        const section = document.getElementById('track');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function setRequestStatus(text, kind) {
        const el = $('#rq-status');
        el.textContent = text || '';
        el.className = 'rq-status' + (kind ? ' ' + kind : '');
    }

    function initRequest() {
        const form = $('#request-form');
        if (!form) return;
        requestPicker = createFilePicker($('#rq-picker'));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = (id) => (document.getElementById(id).value || '').trim();
            if (!val('rq-phone') && !val('rq-email')) {
                setRequestStatus('Please give a WhatsApp/phone number or an e-mail address so I can reach you.', 'error');
                return;
            }
            if (!document.getElementById('rq-consent').checked) {
                setRequestStatus('Please tick the box to confirm you agree to share these details.', 'error');
                return;
            }

            const btn = $('#rq-submit');
            btn.disabled = true;
            setRequestStatus(requestPicker.count() ? 'Uploading your files…' : 'Sending…', '');
            try {
                const session = {};
                const files = await requestPicker.uploadAll(session);
                setRequestStatus('Sending your request…', '');
                const body = {
                    name: val('rq-name'),
                    phone: val('rq-phone'),
                    email: val('rq-email'),
                    org: val('rq-org'),
                    title: val('rq-title'),
                    details: val('rq-details'),
                    files,
                    consent: true,
                    website: val('rq-website')
                };
                if (attachedQuote) body.quote = { no: attachedQuote.no, total: attachedQuote.total, lines: attachedQuote.lines };
                const result = await api('POST', '/api/requests', body);

                form.reset();
                requestPicker.clear();
                attachedQuote = null;
                renderQuoteChip();
                setRequestStatus('', '');
                form.hidden = true;
                $('#rq-ref').textContent = result.reference;
                $('#request-done').hidden = false;
            } catch (err) {
                setRequestStatus(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });

        $('#rq-again').addEventListener('click', () => {
            $('#request-done').hidden = true;
            form.hidden = false;
        });
    }

    /* ---------- boot ---------- */
    function init() {
        if (!document.getElementById('track')) return;

        document.querySelectorAll('.track-tab').forEach((btn) => {
            btn.addEventListener('click', () => showTab(btn.getAttribute('data-tab')));
        });
        document.querySelectorAll('[data-open-track]').forEach((a) => {
            a.addEventListener('click', () => showTab('track'));
        });
        document.querySelectorAll('[data-open-send]').forEach((a) => {
            a.addEventListener('click', () => showTab('send'));
        });

        initTrack();
        initRequest();
        showTab('track');

        // Deep link from WhatsApp / e-mail:  https://yoursite/?track=TAL-XXXXX-XXXXX#track
        const params = new URLSearchParams(window.location.search);
        const fromLink = params.get('track');
        if (fromLink) {
            $('#track-code').value = fromLink.toUpperCase().slice(0, 40);
            lookup(fromLink);
            setTimeout(() => {
                const section = document.getElementById('track');
                if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 600);
        }
    }

    window.TechAssistTracking = { openRequestFromQuote, showTab };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/**
 * Services, Pricing & Quotation Builder
 * ------------------------------------------------------------------
 * Everything you may want to edit later lives in the CONFIG and
 * SERVICE_CATEGORIES blocks right below. Prices are in Sri Lankan Rupees (LKR).
 *
 * Price units:
 *   'fixed' -> per job / per item   (quantity = number of jobs)
 *   'hour'  -> per hour             (quantity = hours, 0.5 steps)
 *   'month' -> per month            (quantity = months)
 *   'quote' -> no fixed price; shown as "To be quoted" on the quotation
 *
 * `from: true` means "starting price" (final price depends on scope).
 */
(function () {
    'use strict';

    /* ------------------------------------------------------------
       CONFIG – change business details, rules and terms here
    ------------------------------------------------------------ */
    const CONFIG = {
        brand: 'TechAssist LK',
        name: 'Imantha Umesh',
        tagline: 'IT · Academic · Digital Services',
        phoneDisplay: '+94 704 124 816',
        whatsappNumber: '94704124816',
        email: 'Umeshbandara08@gmail.com',
        location: 'Ambagamuwa, Ginigathhena, Sri Lanka',
        validityDays: 14,
        quotePrefix: 'TAL',
        storageKey: 'tal_quote_v1',
        counterKey: 'tal_quote_counter_v1',
        studentDiscountRate: 0.10,
        studentDiscountCategories: ['academic', 'docs'],
        advanceThreshold: 20000,   // orders at/above this need an advance
        advanceRate: 0.5,          // 50% advance
        urgency: {
            standard: { label: 'Standard delivery', rate: 0 },
            priority: { label: 'Priority (within 48 hours)', rate: 0.25 },
            express: { label: 'Express (within 24 hours)', rate: 0.5 }
        },
        terms: [
            'Prices are starting estimates in Sri Lankan Rupees (LKR). The final price depends on scope, complexity and time required, and is confirmed in writing before work starts.',
            'Projects of Rs. 20,000 or more require a 50% advance; the balance is due on delivery. Smaller jobs are paid on delivery.',
            'Domain names, hosting, paid software licences, travel and third-party costs are charged separately where applicable.',
            'Only genuine, licensed software is installed. Academic work is provided as guidance, tutoring and editing support for your own work.',
            'Changes outside the agreed scope are quoted separately. Friendly post-delivery support is included for minor fixes.'
        ]
    };

    /* ------------------------------------------------------------
       SERVICES & PRICES – add, update or remove items freely
    ------------------------------------------------------------ */
    const SERVICE_CATEGORIES = [
        {
            id: 'academic',
            title: 'Academic & Student Support',
            short: 'Academic',
            icon: 'fa-graduation-cap',
            tagline: 'Practical help for A/L, university and self-learners.',
            items: [
                { id: 'al-ict', name: 'A/L ICT practical guidance', desc: 'One-to-one or small group, practical-focused sessions.', price: 1000, unit: 'hour' },
                { id: 'prog-tutor', name: 'Programming tutoring', desc: 'Python, Java, web development and Flutter basics to advanced.', price: 1500, unit: 'hour' },
                { id: 'uni-guide', name: 'University project guidance', desc: 'Planning, structure, tech choices and regular feedback.', price: 3000, unit: 'fixed', from: true },
                { id: 'final-year', name: 'Final-year project mentoring', desc: 'Ongoing mentoring from idea to documentation and viva preparation.', price: 7500, unit: 'fixed', from: true },
                { id: 'report-format', name: 'Assignment / report formatting', desc: 'Clean layout, referencing, headings and page numbers.', price: 500, unit: 'fixed', from: true },
                { id: 'ppt', name: 'PowerPoint presentation preparation', desc: 'Well-designed slides from your content.', price: 1000, unit: 'fixed', from: true }
            ]
        },
        {
            id: 'docs',
            title: 'Documents & Writing',
            short: 'Documents',
            icon: 'fa-file-pen',
            tagline: 'Polished documents in Sinhala, Tamil and English.',
            items: [
                { id: 'proof', name: 'Proofreading / language improvement', desc: 'Grammar, clarity and tone, per document.', price: 500, unit: 'fixed', from: true },
                { id: 'write-refine', name: 'Writing refinement (your own draft)', desc: 'Structure and wording improvements while keeping your voice.', price: 1000, unit: 'fixed', from: true },
                { id: 'cv', name: 'CV formatting', desc: 'Professional, ATS-friendly CV layout.', price: 1000, unit: 'fixed', from: true },
                { id: 'pdf-word', name: 'PDF ↔ Word conversion', desc: 'Clean conversion with formatting fixed.', price: 300, unit: 'fixed', from: true },
                { id: 'translate', name: 'Sinhala / Tamil / English translation', desc: 'Priced by length and subject.', price: null, unit: 'quote' }
            ]
        },
        {
            id: 'tech',
            title: 'Installation & Tech Support',
            short: 'Tech Support',
            icon: 'fa-screwdriver-wrench',
            tagline: 'Get your computer, tools and devices working properly.',
            items: [
                { id: 'os-install', name: 'Windows / Ubuntu installation', desc: 'Clean install with drivers.', price: 1500, unit: 'fixed', from: true },
                { id: 'os-full', name: 'OS installation + essential setup', desc: 'OS, Office, browsers, utilities and security basics.', price: 2500, unit: 'fixed', from: true },
                { id: 'dev-tools', name: 'Developer tools installation', desc: 'VS Code, Android Studio, Git, Node.js, Python, databases.', price: 1000, unit: 'fixed', from: true },
                { id: 'troubleshoot', name: 'Software / driver troubleshooting', desc: 'Slow PC, errors, crashes and performance fixes.', price: 1000, unit: 'fixed', from: true },
                { id: 'printer', name: 'Printer / scanner setup', desc: 'Installation, drivers and network sharing.', price: 1000, unit: 'fixed', from: true },
                { id: 'remote', name: 'Remote support session', desc: 'Screen-share help, billed per hour.', price: 1000, unit: 'hour' }
            ]
        },
        {
            id: 'web',
            title: 'Web & Software Development',
            short: 'Development',
            icon: 'fa-code',
            tagline: 'Websites, mobile apps and custom systems built end-to-end.',
            items: [
                { id: 'portfolio-site', name: 'Personal / portfolio website', desc: 'Responsive, fast, modern design.', price: 15000, unit: 'fixed', from: true },
                { id: 'biz-site', name: 'Small business website', desc: 'Multi-page site with contact forms and WhatsApp integration.', price: 25000, unit: 'fixed', from: true },
                { id: 'wp', name: 'WordPress website setup', desc: 'Theme, plugins and basic content setup.', price: 15000, unit: 'fixed', from: true },
                { id: 'ecom', name: 'E-commerce website', desc: 'Product catalogue, cart and order management.', price: 60000, unit: 'fixed', from: true },
                { id: 'web-app', name: 'Custom web application / dashboard', desc: 'Login, database, admin panel and reports tailored to you.', price: 75000, unit: 'fixed', from: true },
                { id: 'mobile-app', name: 'Flutter mobile application', desc: 'Android (and iOS) app with a backend and offline support where needed.', price: 120000, unit: 'fixed', from: true },
                { id: 'school-sys', name: 'School / institute management system', desc: 'Tailored to your institute; scope confirmed after a requirements call.', price: 150000, unit: 'fixed', from: true },
                { id: 'api-db', name: 'API / database development', desc: 'REST APIs, schema design and integrations.', price: 35000, unit: 'fixed', from: true },
                { id: 'maint', name: 'Website maintenance / SEO', desc: 'Updates, backups, performance and on-page SEO.', price: 3000, unit: 'month', from: true },
                { id: 'bugfix', name: 'Bug fixing / existing project support', desc: 'Debugging, improvements and handover of existing code.', price: 1500, unit: 'fixed', from: true }
            ]
        },
        {
            id: 'other',
            title: 'Other Digital Services',
            short: 'Other',
            icon: 'fa-layer-group',
            tagline: 'Data, automation and business IT help.',
            items: [
                { id: 'db-design', name: 'Database design / data entry', desc: 'Structured databases and accurate data entry.', price: 1000, unit: 'fixed', from: true },
                { id: 'online-class', name: 'Online class / quiz setup', desc: 'Zoom, Google Classroom, Forms and quiz systems.', price: 1000, unit: 'fixed', from: true },
                { id: 'excel', name: 'Excel data cleaning / automation', desc: 'Formulas, macros and tidy reports.', price: 1000, unit: 'fixed', from: true },
                { id: 'data-auto', name: 'Data analysis & Python automation', desc: 'Scripts that save hours of repetitive work.', price: 3000, unit: 'fixed', from: true },
                { id: 'biz-it', name: 'Business IT support', desc: 'Planning, setup and ongoing support for small businesses.', price: null, unit: 'quote' },
                { id: 'other-svc', name: 'Other services not listed', desc: 'Tell me what you need and I\'ll price it.', price: null, unit: 'quote' }
            ]
        }
    ];

    const UNIT_LABEL = { fixed: 'per job', hour: 'per hour', month: 'per month', quote: '' };
    const QTY_LABEL = { fixed: 'Qty', hour: 'Hours', month: 'Months', quote: 'Qty' };

    /* ------------------------------------------------------------
       Helpers
    ------------------------------------------------------------ */
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    const esc = (str) => String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const money = (n) => 'Rs. ' + Math.round(n).toLocaleString('en-US');

    const itemIndex = {};
    SERVICE_CATEGORIES.forEach(cat => cat.items.forEach(item => {
        itemIndex[item.id] = Object.assign({ category: cat.id, categoryTitle: cat.title }, item);
    }));

    function priceTag(item) {
        if (item.unit === 'quote' || item.price == null) return '<span class="price-amount">Quote based</span>';
        const unit = UNIT_LABEL[item.unit] ? '<small>' + UNIT_LABEL[item.unit] + '</small>' : '';
        return '<span class="price-amount">' + (item.from ? '<em>From</em> ' : '') + money(item.price) + '</span>' + unit;
    }

    function safeStorage() {
        try {
            const k = '__tal_test__';
            window.localStorage.setItem(k, '1');
            window.localStorage.removeItem(k);
            return window.localStorage;
        } catch (e) {
            return null;
        }
    }
    const store = safeStorage();

    /* ------------------------------------------------------------
       State
    ------------------------------------------------------------ */
    const state = {
        lines: [],            // { key, id, name, categoryId, categoryTitle, price, unit, from, qty, custom }
        client: { name: '', email: '', phone: '', org: '', notes: '', budget: '', budgetNote: '' },
        options: { urgency: 'standard', student: false },
        quoteNo: '',
        quoteDate: ''
    };

    function saveState() {
        if (!store) return;
        try { store.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }

    function loadState() {
        if (!store) return;
        try {
            const raw = store.getItem(CONFIG.storageKey);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (saved && Array.isArray(saved.lines)) {
                state.lines = saved.lines
                    .filter(l => l && l.name && Number(l.qty) > 0)
                    .map(l => {
                        // Always trust the current price list for catalogue items
                        const live = !l.custom && itemIndex[l.id];
                        return live ? Object.assign({}, l, {
                            name: live.name, price: live.price, unit: live.unit, from: !!live.from,
                            categoryId: live.category, categoryTitle: live.categoryTitle
                        }) : l;
                    })
                    .filter(l => l.custom || itemIndex[l.id]);
                Object.assign(state.client, saved.client || {});
                Object.assign(state.options, saved.options || {});
                if (!CONFIG.urgency[state.options.urgency]) state.options.urgency = 'standard';
                state.quoteNo = saved.quoteNo || '';
                state.quoteDate = saved.quoteDate || '';
            }
        } catch (e) { /* ignore corrupt data */ }
    }

    /* ------------------------------------------------------------
       Pricing section (tabs + price list)
    ------------------------------------------------------------ */
    let activeCategory = SERVICE_CATEGORIES[0].id;

    function renderTabs() {
        const tabs = $('#service-tabs');
        if (!tabs) return;
        tabs.innerHTML = SERVICE_CATEGORIES.map(cat =>
            '<button type="button" role="tab" class="service-tab' + (cat.id === activeCategory ? ' active' : '') +
            '" data-cat="' + cat.id + '" aria-selected="' + (cat.id === activeCategory) + '">' +
            '<i class="fas ' + cat.icon + '"></i><span>' + esc(cat.short) + '</span></button>'
        ).join('');
    }

    function renderPanel() {
        const panel = $('#service-panel');
        if (!panel) return;
        const cat = SERVICE_CATEGORIES.find(c => c.id === activeCategory) || SERVICE_CATEGORIES[0];
        panel.innerHTML =
            '<div class="price-panel-head">' +
            '<div class="price-icon"><i class="fas ' + cat.icon + '"></i></div>' +
            '<div><h3>' + esc(cat.title) + '</h3><p>' + esc(cat.tagline) + '</p></div></div>' +
            '<ul class="price-list">' +
            cat.items.map(item =>
                '<li class="price-row">' +
                '<div class="price-info"><span class="price-name">' + esc(item.name) + '</span>' +
                '<span class="price-desc">' + esc(item.desc || '') + '</span></div>' +
                '<div class="price-tag">' + priceTag(item) + '</div>' +
                '<button type="button" class="price-add" data-add="' + item.id + '" aria-label="Add ' + esc(item.name) + ' to quotation" title="Add to quotation">' +
                '<i class="fas fa-plus"></i></button></li>'
            ).join('') +
            '</ul>';
    }

    function renderServiceOverview() {
        const grid = $('#service-overview');
        if (!grid) return;
        grid.innerHTML = SERVICE_CATEGORIES.map(cat =>
            '<button type="button" class="service-card svc-reveal" data-cat="' + cat.id + '">' +
            '<div class="service-card-icon"><i class="fas ' + cat.icon + '"></i></div>' +
            '<h3>' + esc(cat.title) + '</h3>' +
            '<p>' + esc(cat.tagline) + '</p>' +
            '<ul>' + cat.items.slice(0, 3).map(i => '<li><i class="fas fa-check"></i>' + esc(i.name) + '</li>').join('') + '</ul>' +
            '<span class="service-card-link">View prices <i class="fas fa-arrow-right"></i></span>' +
            '</button>'
        ).join('');
    }

    function selectCategory(id, scroll) {
        activeCategory = id;
        renderTabs();
        renderPanel();
        if (scroll) {
            const target = $('#pricing');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /* ------------------------------------------------------------
       Quotation calculations
    ------------------------------------------------------------ */
    function calculate() {
        let subtotal = 0;
        let studentBase = 0;
        const quoted = [];
        const priced = [];

        state.lines.forEach(line => {
            if (line.unit === 'quote' || line.price == null) {
                quoted.push(line);
                return;
            }
            const amount = line.price * line.qty;
            priced.push(Object.assign({}, line, { amount }));
            subtotal += amount;
            if (CONFIG.studentDiscountCategories.indexOf(line.categoryId) !== -1) studentBase += amount;
        });

        const urgency = CONFIG.urgency[state.options.urgency] || CONFIG.urgency.standard;
        const surcharge = Math.round(subtotal * urgency.rate);
        const discount = state.options.student ? Math.round(studentBase * CONFIG.studentDiscountRate) : 0;
        const total = Math.max(0, subtotal + surcharge - discount);
        const needsAdvance = total >= CONFIG.advanceThreshold;
        const advance = needsAdvance ? Math.round(total * CONFIG.advanceRate) : 0;

        return { priced, quoted, subtotal, surcharge, discount, total, needsAdvance, advance, urgency };
    }

    /* ------------------------------------------------------------
       Cart / lines
    ------------------------------------------------------------ */
    function defaultQty(unit) { return unit === 'hour' ? 1 : 1; }

    function addCatalogueLine(id) {
        const item = itemIndex[id];
        if (!item) return;
        const existing = state.lines.find(l => !l.custom && l.id === id);
        if (existing) {
            existing.qty = Math.min(999, existing.qty + 1);
        } else {
            state.lines.push({
                key: 'l_' + id,
                id: id,
                name: item.name,
                categoryId: item.category,
                categoryTitle: item.categoryTitle,
                price: item.price,
                unit: item.unit,
                from: !!item.from,
                qty: defaultQty(item.unit),
                custom: false
            });
        }
        invalidatePreview();
        refreshQuote();
        toast('Added: ' + item.name);
    }

    function addCustomLine(name, price, unit) {
        const n = name.trim();
        if (!n) return false;
        const p = parseFloat(price);
        const hasPrice = isFinite(p) && p > 0;
        state.lines.push({
            key: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            id: 'custom',
            name: n,
            categoryId: 'custom',
            categoryTitle: 'Custom item',
            price: hasPrice ? p : null,
            unit: hasPrice ? unit : 'quote',
            from: false,
            qty: 1,
            custom: true
        });
        invalidatePreview();
        refreshQuote();
        return true;
    }

    function updateQty(key, qty) {
        const line = state.lines.find(l => l.key === key);
        if (!line) return;
        const step = line.unit === 'hour' ? 0.5 : 1;
        const min = step;
        let q = parseFloat(qty);
        if (!isFinite(q)) q = min;
        q = Math.min(999, Math.max(min, q));
        line.qty = Math.round(q * 2) / 2;
        if (line.unit !== 'hour') line.qty = Math.max(1, Math.round(line.qty));
        invalidatePreview();
        refreshQuote();
    }

    function removeLine(key) {
        state.lines = state.lines.filter(l => l.key !== key);
        invalidatePreview();
        refreshQuote();
    }

    function resetQuote() {
        state.lines = [];
        state.client = { name: '', email: '', phone: '', org: '', notes: '', budget: '', budgetNote: '' };
        state.options = { urgency: 'standard', student: false };
        state.quoteNo = '';
        state.quoteDate = '';
        syncInputsFromState();
        invalidatePreview();
        refreshQuote();
    }

    /* ------------------------------------------------------------
       Builder UI
    ------------------------------------------------------------ */
    function lineRowHtml(line) {
        const step = line.unit === 'hour' ? 0.5 : 1;
        const priceText = (line.unit === 'quote' || line.price == null)
            ? '<span class="line-unit">To be quoted</span>'
            : '<span class="line-unit">' + (line.from ? 'From ' : '') + money(line.price) + (UNIT_LABEL[line.unit] ? ' ' + UNIT_LABEL[line.unit] : '') + '</span>';
        const amount = (line.unit === 'quote' || line.price == null)
            ? '<span class="line-amount muted">TBQ</span>'
            : '<span class="line-amount">' + money(line.price * line.qty) + '</span>';
        return '<div class="quote-line" data-key="' + esc(line.key) + '">' +
            '<div class="line-main"><span class="line-name">' + esc(line.name) + '</span>' + priceText + '</div>' +
            '<div class="line-qty" aria-label="' + QTY_LABEL[line.unit] + '">' +
            '<button type="button" class="qty-btn" data-qty="-' + step + '" aria-label="Decrease"><i class="fas fa-minus"></i></button>' +
            '<input type="number" class="qty-input" min="' + step + '" max="999" step="' + step + '" value="' + line.qty + '" aria-label="' + QTY_LABEL[line.unit] + '">' +
            '<button type="button" class="qty-btn" data-qty="' + step + '" aria-label="Increase"><i class="fas fa-plus"></i></button>' +
            '</div>' + amount +
            '<button type="button" class="line-remove" aria-label="Remove ' + esc(line.name) + '"><i class="fas fa-trash-can"></i></button>' +
            '</div>';
    }

    function refreshQuote() {
        const list = $('#quote-lines');
        const empty = $('#quote-empty');
        if (!list) return;

        list.innerHTML = state.lines.map(lineRowHtml).join('');
        if (empty) empty.style.display = state.lines.length ? 'none' : 'block';

        const c = calculate();
        setText('#sum-subtotal', money(c.subtotal));
        setText('#sum-surcharge-label', c.urgency.rate ? 'Urgency surcharge (+' + Math.round(c.urgency.rate * 100) + '%)' : 'Urgency surcharge');
        setText('#sum-surcharge', c.surcharge ? '+ ' + money(c.surcharge) : money(0));
        setText('#sum-discount', c.discount ? '− ' + money(c.discount) : money(0));
        setText('#sum-total', money(c.total));
        const adv = $('#sum-advance');
        if (adv) {
            adv.textContent = c.needsAdvance
                ? 'Advance to start: ' + money(c.advance) + ' (balance on delivery)'
                : (c.total > 0 ? 'No advance needed. Pay on delivery.' : '');
        }
        const tbq = $('#sum-tbq');
        if (tbq) {
            tbq.textContent = c.quoted.length
                ? c.quoted.length + ' item' + (c.quoted.length > 1 ? 's are' : ' is') + ' quote based and not included in the total yet.'
                : '';
            tbq.style.display = c.quoted.length ? 'block' : 'none';
        }

        $$('.js-quote-count').forEach(el => {
            const count = state.lines.length;
            el.textContent = count;
            el.classList.toggle('has-items', count > 0);
        });

        saveState();
    }

    function setText(sel, text) {
        const el = $(sel);
        if (el) el.textContent = text;
    }

    function syncInputsFromState() {
        const map = { 'q-name': 'name', 'q-email': 'email', 'q-phone': 'phone', 'q-org': 'org', 'q-notes': 'notes', 'q-budget': 'budget', 'q-budget-note': 'budgetNote' };
        Object.keys(map).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = state.client[map[id]] || '';
        });
        const urg = document.getElementById('q-urgency');
        if (urg) urg.value = state.options.urgency;
        const stu = document.getElementById('q-student');
        if (stu) stu.checked = !!state.options.student;
    }

    function readClientInputs() {
        state.client.name = (document.getElementById('q-name') || {}).value || '';
        state.client.email = (document.getElementById('q-email') || {}).value || '';
        state.client.phone = (document.getElementById('q-phone') || {}).value || '';
        state.client.org = (document.getElementById('q-org') || {}).value || '';
        state.client.notes = (document.getElementById('q-notes') || {}).value || '';
        state.client.budget = (document.getElementById('q-budget') || {}).value || '';
        state.client.budgetNote = (document.getElementById('q-budget-note') || {}).value || '';
        state.client.name = state.client.name.trim();
        state.client.email = state.client.email.trim();
        state.client.phone = state.client.phone.trim();
        state.client.org = state.client.org.trim();
        state.client.notes = state.client.notes.trim();
        state.client.budget = state.client.budget.trim();
    }

    /* ------------------------------------------------------------
       Quotation document
    ------------------------------------------------------------ */
    function nextQuoteNumber() {
        let n = 1;
        if (store) {
            try {
                n = (parseInt(store.getItem(CONFIG.counterKey), 10) || 0) + 1;
                store.setItem(CONFIG.counterKey, String(n));
            } catch (e) { n = Math.floor(Math.random() * 900) + 100; }
        } else {
            n = Math.floor(Math.random() * 900) + 100;
        }
        const d = new Date();
        const yy = String(d.getFullYear()).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return CONFIG.quotePrefix + '-' + yy + mm + dd + '-' + String(n).padStart(3, '0');
    }

    function fmtDate(d) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function buildQuoteHtml(c) {
        const issued = state.quoteDate ? new Date(state.quoteDate) : new Date();
        const valid = new Date(issued.getTime());
        valid.setDate(valid.getDate() + CONFIG.validityDays);

        const rows = state.lines.map((line, i) => {
            const isQuoted = (line.unit === 'quote' || line.price == null);
            const unitPrice = isQuoted ? 'To be quoted' : (line.from ? 'From ' : '') + money(line.price) + (UNIT_LABEL[line.unit] ? ' <small>' + UNIT_LABEL[line.unit] + '</small>' : '');
            const qty = line.unit === 'hour' ? line.qty + ' h' : (line.unit === 'month' ? line.qty + ' mo' : line.qty);
            const amount = isQuoted ? 'TBQ' : money(line.price * line.qty);
            return '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(line.name) + '</strong><br><small>' + esc(line.categoryTitle) + '</small></td>' +
                '<td class="num">' + unitPrice + '</td><td class="num">' + qty + '</td><td class="num">' + amount + '</td></tr>';
        }).join('');

        const budgetNoteMap = { fixed: 'Fixed — cannot go higher', flexible: 'Slightly flexible', negotiable: 'Open to negotiation' };
        const clientLines = [
            state.client.name ? '<strong>' + esc(state.client.name) + '</strong>' : '',
            state.client.org ? esc(state.client.org) : '',
            state.client.email ? esc(state.client.email) : '',
            state.client.phone ? esc(state.client.phone) : '',
            state.client.budget ? '<em>Budget: Rs. ' + Number(state.client.budget).toLocaleString('en-US') + (state.client.budgetNote ? ' (' + esc(budgetNoteMap[state.client.budgetNote] || state.client.budgetNote) + ')' : '') + '</em>' : ''
        ].filter(Boolean).join('<br>');

        return '' +
            '<div class="quote-head">' +
            '<div><div class="qd-brand">' + esc(CONFIG.brand) + '</div>' +
            '<div class="qd-sub">' + esc(CONFIG.name) + ' · ' + esc(CONFIG.tagline) + '</div></div>' +
            '<div class="qd-title">QUOTATION</div></div>' +
            '<div class="quote-meta">' +
            '<div><span>Quotation No.</span><strong>' + esc(state.quoteNo) + '</strong></div>' +
            '<div><span>Date</span><strong>' + fmtDate(issued) + '</strong></div>' +
            '<div><span>Valid until</span><strong>' + fmtDate(valid) + '</strong></div></div>' +
            '<div class="quote-parties">' +
            '<div><h4>From</h4><p><strong>' + esc(CONFIG.name) + '</strong><br>' + esc(CONFIG.brand) + '<br>' + esc(CONFIG.phoneDisplay) + '<br>' + esc(CONFIG.email) + '<br>' + esc(CONFIG.location) + '</p></div>' +
            '<div><h4>Prepared for</h4><p>' + (clientLines || '—') + '</p></div></div>' +
            '<table class="quote-table"><thead><tr><th>#</th><th>Description</th><th class="num">Rate</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>' +
            '<div class="quote-totals">' +
            '<div><span>Subtotal</span><span>' + money(c.subtotal) + '</span></div>' +
            (c.surcharge ? '<div><span>' + esc(c.urgency.label) + ' surcharge</span><span>+ ' + money(c.surcharge) + '</span></div>' : '') +
            (c.discount ? '<div><span>Student discount (' + Math.round(CONFIG.studentDiscountRate * 100) + '%)</span><span>− ' + money(c.discount) + '</span></div>' : '') +
            '<div class="grand"><span>Estimated total (LKR)</span><span>' + money(c.total) + '</span></div>' +
            (c.needsAdvance ? '<div class="advance"><span>Advance to start (' + Math.round(CONFIG.advanceRate * 100) + '%)</span><span>' + money(c.advance) + '</span></div>' : '') +
            '</div>' +
            (c.quoted.length ? '<p class="quote-tbq">TBQ = to be quoted. These items are not included in the total and will be priced after we discuss your requirements.</p>' : '') +
            (state.client.notes ? '<div class="quote-notes"><h4>Project notes</h4><p>' + esc(state.client.notes).replace(/\n/g, '<br>') + '</p></div>' : '') +
            (state.client.budget ? '<div class="quote-budget"><h4>Client budget</h4><p>Rs. ' + Number(state.client.budget).toLocaleString('en-US') + (state.client.budgetNote ? ' — ' + esc({ fixed: 'Fixed (cannot go higher)', flexible: 'Slightly flexible', negotiable: 'Open to negotiation' }[state.client.budgetNote] || state.client.budgetNote) : '') + '<br><small>I will review this budget and confirm whether the work is feasible before starting.</small></p></div>' : '') +
            '<div class="quote-terms"><h4>Terms &amp; conditions</h4><ol>' + CONFIG.terms.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol></div>' +
            '<div class="quote-foot">Thank you for considering ' + esc(CONFIG.brand) + '. To accept or negotiate this quotation, reply on WhatsApp ' + esc(CONFIG.phoneDisplay) + ' (preferred) or email ' + esc(CONFIG.email) + '.</div>';
    }

    function quoteAsText(c) {
        const budgetNoteLabels = { fixed: 'Fixed — cannot go higher', flexible: 'Slightly flexible', negotiable: 'Open to negotiation' };
        const lines = [];
        lines.push('*Quotation ' + state.quoteNo + '*  (' + CONFIG.brand + ')');
        lines.push('');
        lines.push('From: ' + (state.client.name || '-') + (state.client.org ? ' (' + state.client.org + ')' : ''));
        if (state.client.phone) lines.push('WhatsApp/Phone: ' + state.client.phone);
        if (state.client.email) lines.push('Email: ' + state.client.email);
        if (state.client.budget) {
            const bnLabel = state.client.budgetNote ? ' (' + (budgetNoteLabels[state.client.budgetNote] || state.client.budgetNote) + ')' : '';
            lines.push('*Budget: Rs. ' + Number(state.client.budget).toLocaleString('en-US') + bnLabel + '*');
        }
        lines.push('');
        lines.push('Services requested:');
        state.lines.forEach((line, i) => {
            const isQuoted = (line.unit === 'quote' || line.price == null);
            const q = line.unit === 'hour' ? line.qty + ' h' : (line.unit === 'month' ? line.qty + ' mo' : 'x' + line.qty);
            lines.push((i + 1) + '. ' + line.name + ' - ' + (isQuoted ? 'to be quoted' : q + ' = ' + money(line.price * line.qty) + (line.from ? ' (from)' : '')));
        });
        lines.push('');
        lines.push('Subtotal: ' + money(c.subtotal));
        if (c.surcharge) lines.push(c.urgency.label + ': + ' + money(c.surcharge));
        if (c.discount) lines.push('Student discount: - ' + money(c.discount));
        lines.push('*Estimated total: ' + money(c.total) + '*');
        if (c.needsAdvance) lines.push('Advance (' + Math.round(CONFIG.advanceRate * 100) + '%): ' + money(c.advance));
        if (state.client.notes) { lines.push(''); lines.push('Project notes: ' + state.client.notes); }
        lines.push('');
        lines.push('Please review my budget and let me know if the work is possible. Happy to negotiate.');
        lines.push('Valid for ' + CONFIG.validityDays + ' days. Final price confirmed after scope review.');
        return lines.join('\n');
    }

    let previewReady = false;

    function invalidatePreview() {
        previewReady = false;
        const box = $('#quote-preview');
        if (box) box.classList.remove('visible');
        const actions = $('#quote-actions');
        if (actions) actions.classList.remove('visible');
    }

    function generateQuote() {
        readClientInputs();
        if (!state.lines.length) {
            setStatus('Add at least one service from the price list first.', 'error');
            return false;
        }
        if (!state.client.name) {
            setStatus('Please enter your name.', 'error');
            const el = document.getElementById('q-name');
            if (el) el.focus();
            return false;
        }
        if (!state.client.phone) {
            setStatus('Please enter your WhatsApp / phone number so I can contact you.', 'error');
            const el = document.getElementById('q-phone');
            if (el) el.focus();
            return false;
        }
        if (state.client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.client.email)) {
            setStatus('That email address does not look right.', 'error');
            const el = document.getElementById('q-email');
            if (el) el.focus();
            return false;
        }
        if (!state.quoteNo) {
            state.quoteNo = nextQuoteNumber();
            state.quoteDate = new Date().toISOString();
        }
        const c = calculate();
        const doc = $('#quote-document');
        if (!doc) return false;
        doc.innerHTML = buildQuoteHtml(c);

        const box = $('#quote-preview');
        if (box) box.classList.add('visible');
        const actions = $('#quote-actions');
        if (actions) actions.classList.add('visible');
        previewReady = true;
        saveState();
        setStatus('Quotation ' + state.quoteNo + ' is ready. Send it on WhatsApp for the fastest reply, or download as PDF.', 'success');
        if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
    }

    function printQuote() {
        if (!previewReady && !generateQuote()) return;
        const doc = $('#quote-document');
        if (!doc) return;

        const root = document.createElement('div');
        root.id = 'quote-print-root';
        root.innerHTML = '<div class="quote-document">' + doc.innerHTML + '</div>';
        document.body.appendChild(root);
        document.body.classList.add('print-quote-mode');

        const previousTitle = document.title;
        document.title = state.quoteNo + ' - ' + CONFIG.brand;

        const cleanup = () => {
            document.body.classList.remove('print-quote-mode');
            if (root.parentNode) root.parentNode.removeChild(root);
            document.title = previousTitle;
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        window.print();
        // Fallback for browsers that do not fire afterprint reliably
        setTimeout(() => { if (document.body.classList.contains('print-quote-mode')) cleanup(); }, 60000);
    }

    function sendWhatsApp() {
        if (!previewReady && !generateQuote()) return;
        const text = quoteAsText(calculate());
        window.open('https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    }

    function sendEmail() {
        if (!previewReady && !generateQuote()) return;
        const text = quoteAsText(calculate()).replace(/\*/g, '');
        const subject = 'Quotation request ' + state.quoteNo + ' - ' + (state.client.name || 'Client');
        window.location.href = 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    }

    function copyQuote() {
        if (!previewReady && !generateQuote()) return;
        const text = quoteAsText(calculate()).replace(/\*/g, '');
        const done = () => setStatus('Quotation text copied to clipboard.', 'success');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
        } else {
            fallbackCopy(text, done);
        }
    }

    function fallbackCopy(text, done) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { setStatus('Could not copy. Please select the text manually.', 'error'); }
        document.body.removeChild(ta);
    }

    /* ------------------------------------------------------------
       Feedback (status line + toast)
    ------------------------------------------------------------ */
    let statusTimer = null;
    function setStatus(msg, type) {
        const el = $('#quote-status');
        if (!el) return;
        el.textContent = msg;
        el.className = 'quote-status ' + (type || '');
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => { el.textContent = ''; el.className = 'quote-status'; }, 6000);
    }

    let toastTimer = null;
    function toast(msg) {
        let el = $('#quote-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'quote-toast';
            el.className = 'quote-toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.innerHTML = '<i class="fas fa-circle-check"></i> ' + esc(msg) +
            ' <a href="#quotation">View quote (' + state.lines.length + ')</a>';
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
    }

    /* ------------------------------------------------------------
       Events
    ------------------------------------------------------------ */
    function bindEvents() {
        document.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-cat]');
            if (tab) {
                const isCard = tab.classList.contains('service-card');
                selectCategory(tab.getAttribute('data-cat'), isCard);
                return;
            }
            const add = e.target.closest('[data-add]');
            if (add) {
                addCatalogueLine(add.getAttribute('data-add'));
                return;
            }
        });

        const lines = $('#quote-lines');
        if (lines) {
            lines.addEventListener('click', (e) => {
                const row = e.target.closest('.quote-line');
                if (!row) return;
                const key = row.getAttribute('data-key');
                if (e.target.closest('.line-remove')) {
                    removeLine(key);
                    return;
                }
                const btn = e.target.closest('.qty-btn');
                if (btn) {
                    const line = state.lines.find(l => l.key === key);
                    if (line) updateQty(key, line.qty + parseFloat(btn.getAttribute('data-qty')));
                }
            });
            lines.addEventListener('change', (e) => {
                if (!e.target.classList.contains('qty-input')) return;
                const row = e.target.closest('.quote-line');
                if (row) updateQty(row.getAttribute('data-key'), e.target.value);
            });
        }

        const customForm = $('#custom-item-form');
        if (customForm) {
            customForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = $('#c-name').value;
                const price = $('#c-price').value;
                const unit = $('#c-unit').value;
                if (addCustomLine(name, price, unit)) {
                    customForm.reset();
                    toast('Custom item added');
                } else {
                    setStatus('Enter a description for the custom item.', 'error');
                }
            });
        }

        ['q-name', 'q-email', 'q-phone', 'q-org', 'q-notes', 'q-budget'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => { readClientInputs(); invalidatePreview(); saveState(); });
        });

        const budgetNote = document.getElementById('q-budget-note');
        if (budgetNote) budgetNote.addEventListener('change', () => { readClientInputs(); invalidatePreview(); saveState(); });

        const urg = document.getElementById('q-urgency');
        if (urg) urg.addEventListener('change', () => {
            state.options.urgency = urg.value;
            invalidatePreview();
            refreshQuote();
        });

        const stu = document.getElementById('q-student');
        if (stu) stu.addEventListener('change', () => {
            state.options.student = stu.checked;
            invalidatePreview();
            refreshQuote();
        });

        const actions = {
            'btn-generate': generateQuote,
            'btn-print': printQuote,
            'btn-whatsapp': sendWhatsApp,
            'btn-email': sendEmail,
            'btn-copy': copyQuote,
            'btn-reset': () => {
                if (!state.lines.length || window.confirm('Clear the current quotation and start a new one?')) resetQuote();
            }
        };
        Object.keys(actions).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', (e) => { e.preventDefault(); actions[id](); });
        });
    }

    function initReveal() {
        const items = $$('.svc-reveal');
        if (!('IntersectionObserver' in window)) {
            items.forEach(el => el.classList.add('in'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        items.forEach(el => io.observe(el));
    }

    /* ------------------------------------------------------------
       Init
    ------------------------------------------------------------ */
    function init() {
        if (!$('#services')) return;
        loadState();
        renderServiceOverview();
        renderTabs();
        renderPanel();
        syncInputsFromState();
        refreshQuote();
        bindEvents();
        initReveal();
    }

    // Public hook so other scripts (e.g. the chatbot) can read the price list
    window.TechAssistServices = {
        config: CONFIG,
        categories: SERVICE_CATEGORIES,
        format: money
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

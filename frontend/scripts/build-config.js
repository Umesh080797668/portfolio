'use strict';

/**
 * Builds the two generated files the static website needs, from frontend/.env
 * (or from real environment variables, which win; that is how Netlify / Cloudflare Pages work):
 *
 *   config.js  - browser settings (window.__TAL_CONFIG__). ONLY non-secret values.
 *   _headers   - security headers (Content-Security-Policy ...) for Netlify / Cloudflare Pages.
 *
 * Run:  npm run build
 * Nothing in here is a secret. Secrets live in backend/.env and never reach the website.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function parseEnvFile(file) {
    const out = {};
    if (!fs.existsSync(file)) return out;
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
        if (line.trim().startsWith('#')) return;
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
        if (!m) return;
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        out[m[1]] = v;
    });
    return out;
}

const env = Object.assign({}, parseEnvFile(path.join(root, '.env')), process.env);
const get = (k, d) => (env[k] !== undefined && env[k] !== '' ? String(env[k]) : d);

const apiBase = get('API_BASE_URL', '').replace(/\/+$/, '');
const config = {
    apiBase,
    maxFileMb: Math.max(1, parseInt(get('MAX_FILE_MB', '10'), 10) || 10),
    maxFiles: Math.max(1, parseInt(get('MAX_FILES_PER_REQUEST', '5'), 10) || 5),
    // Public by design: the anon key can access nothing (Row Level Security). Used only for realtime pings.
    supabaseUrl: get('SUPABASE_URL', '').replace(/\/+$/, ''),
    supabaseAnonKey: get('SUPABASE_ANON_KEY', ''),
    whatsapp: get('WHATSAPP_NUMBER', '').replace(/[^0-9]/g, ''),
    formspreeId: get('FORMSPREE_FORM_ID', '').replace(/[^a-zA-Z0-9]/g, '')
};

let apiOrigin = '';
if (apiBase) {
    try { apiOrigin = new URL(apiBase).origin; } catch (e) {
        console.error(`API_BASE_URL is not a valid URL: ${apiBase}`);
        process.exit(1);
    }
} else {
    console.warn('Warning: API_BASE_URL is empty. Requests, file sending and tracking will not work until you set it.');
}
if (!config.formspreeId) console.warn('Warning: FORMSPREE_FORM_ID is empty. The contact form will not send.');

fs.writeFileSync(path.join(root, 'config.js'), `window.__TAL_CONFIG__=${JSON.stringify(config)};\n`);

let supabaseHttp = '';
let supabaseWs = '';
if (config.supabaseUrl) {
    try {
        const u = new URL(config.supabaseUrl);
        supabaseHttp = u.origin;
        supabaseWs = `wss://${u.host}`;
    } catch (e) {
        console.error(`SUPABASE_URL is not a valid URL: ${config.supabaseUrl}`);
        process.exit(1);
    }
} else {
    console.warn('Note: SUPABASE_URL is empty. Tracking still works, but refreshes every 20 seconds instead of instantly.');
}

const connect = ["'self'", apiOrigin, supabaseHttp, supabaseWs, 'https://api.cloudinary.com', 'https://formspree.io'].filter(Boolean).join(' ');
const csp = [
    "default-src 'self'",
    "script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://formspree.io",
    "frame-ancestors 'none'"
].join('; ');

fs.writeFileSync(path.join(root, '_headers'), `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`);

console.log('Wrote config.js and _headers');
console.log(`  API: ${apiBase || '(not set)'}`);

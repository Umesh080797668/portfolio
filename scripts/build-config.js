'use strict';

/**
 * Only needed when the static website is hosted somewhere else than this Node server
 * (for example GitHub Pages). Generates /config.js from your .env using ONLY the
 * non-secret, browser-safe values. Run:  npm run build:config
 */
const fs = require('fs');
const path = require('path');
const { buildConfig } = require('../server/config');

const cfg = buildConfig();
const publicConfig = Object.assign({
    apiBase: cfg.apiBase,
    maxFileMb: Math.round(cfg.limits.maxFileBytes / 1048576),
    maxFiles: cfg.limits.maxFiles
}, cfg.publicClient);

if (!cfg.apiBase) {
    console.warn('Warning: PUBLIC_API_BASE is empty. The static site will call its own origin for /api.');
}

const target = path.join(__dirname, '..', 'config.js');
fs.writeFileSync(target, `window.__TAL_CONFIG__=${JSON.stringify(publicConfig)};\n`);
console.log(`Wrote ${target}`);

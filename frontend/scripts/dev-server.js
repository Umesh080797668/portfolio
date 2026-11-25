'use strict';

/**
 * Tiny static server for LOCAL preview only (production uses Netlify, Cloudflare Pages, GitHub Pages ...).
 * It applies the headers from the generated _headers file so you can spot Content-Security-Policy problems
 * before deploying, and it refuses to serve anything that is not part of the website.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = parseInt(process.env.PORT || '3200', 10);
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.webp': 'image/webp'
};
const ALLOWED_TOP = new Set(['index.html', 'services.html', 'config.js', 'css', 'js', 'assets']);

function headersFromFile() {
    const out = {};
    try {
        fs.readFileSync(path.join(root, '_headers'), 'utf8').split(/\r?\n/).slice(1).forEach((line) => {
            const m = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line);
            if (m) out[m[1]] = m[2];
        });
    } catch (e) { /* run "npm run build" first */ }
    return out;
}

http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { rel = ''; }
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(root, rel));
    const top = path.relative(root, file).split(path.sep)[0];

    if (!file.startsWith(root + path.sep) || !ALLOWED_TOP.has(top) || rel.split('/').some((p) => p.startsWith('.'))) {
        res.writeHead(404); return res.end('Not found');
    }
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, Object.assign({
            'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        }, headersFromFile()));
        res.end(data);
    });
}).listen(port, '127.0.0.1', () => console.log(`Website preview: http://127.0.0.1:${port}`));

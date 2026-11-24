'use strict';

const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');

/** Remove control characters (keep new lines/tabs) and trim. */
function cleanText(value) {
    return String(value == null ? '' : value)
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim();
}

function safeEqual(a, b) {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

/* ---------- Upload tokens ----------
   The server signs "this folder may receive files until <time>" so a visitor cannot
   attach files that live in someone else's folder to their own request. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

function signUploadToken(secret, folder, now) {
    const exp = (now || Date.now()) + TOKEN_TTL_MS;
    const sig = crypto.createHmac('sha256', secret).update(`${folder}|${exp}`).digest('base64url');
    return `${exp}.${sig}`;
}

function verifyUploadToken(secret, folder, token, now) {
    if (typeof token !== 'string' || !token.includes('.')) return false;
    const [expRaw, sig] = token.split('.');
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < (now || Date.now())) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${folder}|${exp}`).digest('base64url');
    return safeEqual(sig || '', expected);
}

/* ---------- Files ---------- */
const BLOCKED_EXTENSIONS = new Set([
    'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'lnk', 'hta', 'vbs', 'vbe', 'wsf', 'ps1', 'psm1',
    'sh', 'bash', 'dll', 'sys', 'jar', 'app', 'dmg', 'reg', 'cpl', 'msc', 'apk'
]);

function extensionOf(fileName) {
    const m = /\.([a-zA-Z0-9]{1,10})$/.exec(String(fileName || '').trim());
    return m ? m[1].toLowerCase() : '';
}

function isBlockedFileName(fileName) {
    const parts = String(fileName || '').toLowerCase().split('.').slice(1);
    // also catches double extensions such as "invoice.pdf.exe"
    return parts.some((p) => BLOCKED_EXTENSIONS.has(p));
}

function displayFileName(name) {
    return cleanText(name).replace(/[\\/]/g, '_').slice(0, 180) || 'file';
}

/* ---------- Rate limiting ---------- */
function limiter(windowMs, limit, message) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: message || 'Too many requests. Please try again later.' }
    });
}

module.exports = {
    cleanText,
    safeEqual,
    signUploadToken,
    verifyUploadToken,
    isBlockedFileName,
    extensionOf,
    displayFileName,
    limiter,
    BLOCKED_EXTENSIONS
};

'use strict';

const crypto = require('crypto');

// 31 characters: no 0/O, 1/I/L to avoid mistakes when a code is read out or typed from WhatsApp.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PREFIX = 'TAL';
const PART_LENGTH = 5;

function randomPart() {
    let out = '';
    for (let i = 0; i < PART_LENGTH; i += 1) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
    return out;
}

/** e.g. TAL-7K4MQ-9XR2B  (31^10 ≈ 2^49.5 combinations) */
function generateTrackingCode() {
    return `${PREFIX}-${randomPart()}-${randomPart()}`;
}

/**
 * Accepts what a visitor might type ("tal 7k4mq 9xr2b", "TAL7K4MQ9XR2B", ...)
 * and returns the canonical code, or null when it cannot be a valid code.
 */
function normalizeTrackingCode(input) {
    if (typeof input !== 'string' || input.length > 40) return null;
    let s = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.startsWith(PREFIX)) s = s.slice(PREFIX.length);
    if (s.length !== PART_LENGTH * 2) return null;
    for (const ch of s) if (!ALPHABET.includes(ch)) return null;
    return `${PREFIX}-${s.slice(0, PART_LENGTH)}-${s.slice(PART_LENGTH)}`;
}

module.exports = { generateTrackingCode, normalizeTrackingCode, ALPHABET };

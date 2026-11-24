'use strict';

/**
 * Central configuration. EVERY secret and deployment setting is read from
 * environment variables (loaded from the .env file in development).
 * Nothing sensitive is hard-coded anywhere in the repository.
 */
const path = require('path');

function loadDotenv() {
    try {
        require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
    } catch (e) {
        /* dotenv is optional when real environment variables are provided */
    }
}

const toBool = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    return /^(1|true|yes|on)$/i.test(String(value).trim());
};

const toInt = (value, fallback, min, max) => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max === undefined ? n : max, Math.max(min === undefined ? n : min, n));
};

const toList = (value) => String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function buildConfig(env) {
    env = env || process.env;
    const isProd = (env.NODE_ENV || 'development') === 'production';

    return {
        env: env.NODE_ENV || 'development',
        isProd,
        publicPort: toInt(env.PUBLIC_PORT, 3000, 1, 65535),
        publicHost: env.PUBLIC_HOST || '0.0.0.0',
        adminPort: toInt(env.ADMIN_PORT, 3001, 1, 65535),
        adminHost: env.ADMIN_BIND_HOST || '127.0.0.1',
        trustProxy: toInt(env.TRUST_PROXY, 0, 0, 10),
        corsOrigins: toList(env.CORS_ORIGINS),
        apiBase: (env.PUBLIC_API_BASE || '').replace(/\/+$/, ''),
        publicBaseUrl: (env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),

        supabase: {
            url: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
            anonKey: env.SUPABASE_ANON_KEY || '',
            serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || ''
        },

        cloudinary: {
            cloudName: env.CLOUDINARY_CLOUD_NAME || '',
            apiKey: env.CLOUDINARY_API_KEY || '',
            apiSecret: env.CLOUDINARY_API_SECRET || '',
            folder: (env.CLOUDINARY_FOLDER || 'techassist').replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/^\/+|\/+$/g, '') || 'techassist'
        },

        admin: {
            emails: toList(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
            requireMfa: toBool(env.ADMIN_REQUIRE_MFA, true)
        },

        uploadTokenSecret: env.UPLOAD_TOKEN_SECRET || '',

        limits: {
            maxFileBytes: toInt(env.MAX_FILE_MB, 10, 1, 100) * 1024 * 1024,
            maxFiles: toInt(env.MAX_FILES_PER_REQUEST, 5, 1, 20)
        },

        // Requests allowed per window, per IP address
        rate: {
            api: toInt(env.RATE_API_PER_MIN, 120, 1),
            track: toInt(env.RATE_TRACK_PER_MIN, 30, 1),
            sign: toInt(env.RATE_SIGN_PER_10MIN, 30, 1),
            submit: toInt(env.RATE_SUBMIT_PER_HOUR, 5, 1),
            admin: toInt(env.RATE_ADMIN_PER_MIN, 300, 1),
            streamsPerIp: toInt(env.MAX_STREAMS_PER_IP, 5, 1)
        },

        // Values that are safe to send to the browser
        publicClient: {
            whatsapp: (env.WHATSAPP_NUMBER || '').replace(/[^0-9]/g, ''),
            formspreeId: (env.FORMSPREE_FORM_ID || '').replace(/[^a-zA-Z0-9]/g, '')
        }
    };
}

/** Returns a list of human readable problems (never the secret values). */
function validateConfig(cfg) {
    const problems = [];
    const need = (value, name) => { if (!value) problems.push(`${name} is missing`); };

    need(cfg.supabase.url, 'SUPABASE_URL');
    need(cfg.supabase.anonKey, 'SUPABASE_ANON_KEY');
    need(cfg.supabase.serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY');
    need(cfg.cloudinary.cloudName, 'CLOUDINARY_CLOUD_NAME');
    need(cfg.cloudinary.apiKey, 'CLOUDINARY_API_KEY');
    need(cfg.cloudinary.apiSecret, 'CLOUDINARY_API_SECRET');
    if (!cfg.admin.emails.length) problems.push('ADMIN_EMAILS must list at least one admin e-mail');
    if (cfg.uploadTokenSecret.length < 32) problems.push('UPLOAD_TOKEN_SECRET must be at least 32 characters');
    if (cfg.isProd && !cfg.admin.requireMfa) problems.push('ADMIN_REQUIRE_MFA must be true in production');
    if (cfg.isProd && cfg.publicPort === cfg.adminPort) problems.push('PUBLIC_PORT and ADMIN_PORT must be different');
    return problems;
}

loadDotenv();

module.exports = { buildConfig, validateConfig, loadDotenv };

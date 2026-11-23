/**
 * TECHASSIST LK - TRACKER & CLOUD STORAGE CONFIGURATION
 * 
 * Safely resolves environment variables without hardcoding secrets in source files.
 * Netlify Configuration:
 * Add your environment variables in Netlify Dashboard:
 * Site configuration -> Environment variables:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_UPLOAD_PRESET
 * - CLOUDINARY_FOLDER (optional, defaults to 'techassist_lk/tasks')
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - ADMIN_TRACKER_PIN (optional, defaults to '2026')
 * - ADMIN_WHATSAPP_NUMBER (optional, defaults to '94704124816')
 * - PORTFOLIO_SITE_URL (optional)
 */

(function (window) {
    'use strict';

    const env = window.__ENV__ || window.ENV || (typeof process !== 'undefined' && process.env) || {};

    function getEnv(key, fallback = '') {
        return env[key] || fallback;
    }

    window.TRACKER_CONFIG = {
        // Cloudinary Storage Config (PDF, Excel, TXT, Word, Images, ZIP)
        cloudinary: {
            cloudName: getEnv('CLOUDINARY_CLOUD_NAME', ''),
            uploadPreset: getEnv('CLOUDINARY_UPLOAD_PRESET', ''),
            folder: getEnv('CLOUDINARY_FOLDER', 'techassist_lk/tasks'),
            maxFileSizeMB: 25,
            allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf', 'zip', 'rar', 'png', 'jpg', 'jpeg', 'webp']
        },

        // Supabase Database & Realtime Config
        supabase: {
            url: getEnv('SUPABASE_URL', ''),
            anonKey: getEnv('SUPABASE_ANON_KEY', '')
        },

        // Admin Tracker Portal Config
        admin: {
            pin: getEnv('ADMIN_TRACKER_PIN', '2026'),
            whatsappNumber: getEnv('ADMIN_WHATSAPP_NUMBER', '94704124816'),
            email: getEnv('ADMIN_EMAIL', 'Umeshbandara08@gmail.com'),
            ownerName: 'Imantha Umesh',
            brandName: 'TechAssist LK'
        },

        // Deployment URL
        siteUrl: getEnv('PORTFOLIO_SITE_URL', window.location.origin),

        // Tracking Code generator prefix
        trackingPrefix: 'TRK',

        // Status definitions & display meta
        stages: [
            { key: 'submitted', label: 'Request Received', icon: 'fa-clipboard-check', desc: 'Task & files safely logged.' },
            { key: 'reviewing', label: 'Assessment & Scope', icon: 'fa-magnifying-glass', desc: 'Reviewing requirements & timeline.' },
            { key: 'in_progress', label: 'In Progress', icon: 'fa-laptop-code', desc: 'Active work / development ongoing.' },
            { key: 'quality_polish', label: 'Review & Polish', icon: 'fa-circle-check', desc: 'Final testing, quality check & verification.' },
            { key: 'completed', label: 'Ready & Delivered', icon: 'fa-rocket', desc: 'Work complete. Deliverables ready!' }
        ]
    };

    // Attempt to load uncommitted local env.json if running locally in development
    fetch('env.json')
        .then(res => res.ok ? res.json() : null)
        .then(json => {
            if (json) {
                if (json.CLOUDINARY_CLOUD_NAME && !window.TRACKER_CONFIG.cloudinary.cloudName) {
                    window.TRACKER_CONFIG.cloudinary.cloudName = json.CLOUDINARY_CLOUD_NAME;
                }
                if (json.CLOUDINARY_UPLOAD_PRESET && !window.TRACKER_CONFIG.cloudinary.uploadPreset) {
                    window.TRACKER_CONFIG.cloudinary.uploadPreset = json.CLOUDINARY_UPLOAD_PRESET;
                }
                if (json.SUPABASE_URL && !window.TRACKER_CONFIG.supabase.url) {
                    window.TRACKER_CONFIG.supabase.url = json.SUPABASE_URL;
                }
                if (json.SUPABASE_ANON_KEY && !window.TRACKER_CONFIG.supabase.anonKey) {
                    window.TRACKER_CONFIG.supabase.anonKey = json.SUPABASE_ANON_KEY;
                }
                if (json.ADMIN_TRACKER_PIN && window.TRACKER_CONFIG.admin.pin === '2026') {
                    window.TRACKER_CONFIG.admin.pin = json.ADMIN_TRACKER_PIN;
                }
                if (json.ADMIN_WHATSAPP_NUMBER) {
                    window.TRACKER_CONFIG.admin.whatsappNumber = json.ADMIN_WHATSAPP_NUMBER;
                }
            }
        })
        .catch(() => {});

})(window);

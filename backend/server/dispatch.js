'use strict';

/**
 * One Vercel function, two completely separate apps, chosen by HOST NAME:
 *   api.yourdomain.com    -> public visitor API only (there is no admin code path on this host)
 *   admin.yourdomain.com  -> admin dashboard + admin API (ADMIN_HOSTNAME)
 * If ADMIN_HOSTNAME is not set the admin dashboard is simply switched off.
 */
function createDispatcher({ cfg, publicApp, adminApp }) {
    return function dispatch(req, res) {
        const host = String(req.headers.host || '').split(':')[0].trim().toLowerCase();
        if (cfg.adminHostname && host === cfg.adminHostname) return adminApp(req, res);
        return publicApp(req, res);
    };
}

module.exports = { createDispatcher };

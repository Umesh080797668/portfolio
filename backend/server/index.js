'use strict';

/**
 * LOCAL / VPS entry point. Starts two separate HTTP servers:
 *   - PUBLIC  (PUBLIC_PORT)  visitor API (the website itself is hosted from /frontend)
 *   - ADMIN   (ADMIN_PORT)   dashboard + admin API, bound to ADMIN_BIND_HOST (localhost by default)
 * On Vercel this file is not used: see api/index.js.
 */
const { createRuntime } = require('./runtime');

function main() {
    let runtime;
    try {
        runtime = createRuntime();
    } catch (e) {
        console.error('Configuration problems (check backend/.env, see .env.example):');
        (e.problems || [e.message]).forEach((p) => console.error(` - ${p}`));
        process.exit(1);
    }
    const { cfg, publicApp, adminApp } = runtime;

    if (!cfg.corsOrigins.length) {
        console.warn('Warning: FRONTEND_URL is empty, so browsers on your website cannot call this API (CORS).');
    }

    const publicServer = publicApp.listen(cfg.publicPort, cfg.publicHost, () => {
        console.log(`Public API         http://${cfg.publicHost}:${cfg.publicPort}`);
    });
    const adminServer = adminApp.listen(cfg.adminPort, cfg.adminHost, () => {
        console.log(`Admin dashboard    http://${cfg.adminHost}:${cfg.adminPort}  (keep private)`);
    });

    const shutdown = () => {
        publicServer.close();
        adminServer.close();
        setTimeout(() => process.exit(0), 3000).unref();
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

if (require.main === module) main();

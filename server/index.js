'use strict';

/**
 * Entry point. Starts two separate HTTP servers:
 *   - PUBLIC  (PUBLIC_PORT)  website + visitor API
 *   - ADMIN   (ADMIN_PORT)   dashboard + admin API, bound to ADMIN_BIND_HOST (localhost by default)
 */
const { buildConfig, validateConfig } = require('./config');
const { createBus } = require('./lib/bus');
const { createSupabaseStore } = require('./lib/store');
const { createSupabaseAuth } = require('./lib/auth');
const { createCloudinaryStorage } = require('./lib/storage');
const { createPublicApp } = require('./app-public');
const { createAdminApp } = require('./app-admin');

function main() {
    const cfg = buildConfig();
    const problems = validateConfig(cfg);
    if (problems.length) {
        console.error('Configuration problems (check your .env file, see .env.example):');
        problems.forEach((p) => console.error(` - ${p}`));
        process.exit(1);
    }

    const { createClient } = require('@supabase/supabase-js');
    // Service-role client: server only, bypasses Row Level Security. Sessions are never persisted.
    const supabase = createClient(cfg.supabase.url, cfg.supabase.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    const store = createSupabaseStore(supabase);
    const auth = createSupabaseAuth(supabase);
    const storage = createCloudinaryStorage(cfg);
    const bus = createBus();

    // Anything that changes an order (even edits made in the Supabase dashboard) wakes the live streams
    try {
        store.subscribe((orderId) => bus.publish(orderId));
    } catch (e) {
        console.warn('Realtime bridge not active; live updates still work for changes made through the admin dashboard.');
    }

    const publicServer = createPublicApp({ cfg, store, storage, bus }).listen(cfg.publicPort, cfg.publicHost, () => {
        console.log(`Public site + API  http://${cfg.publicHost}:${cfg.publicPort}`);
    });
    const adminServer = createAdminApp({ cfg, store, storage, auth, bus }).listen(cfg.adminPort, cfg.adminHost, () => {
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

'use strict';

/** Wires configuration, Supabase, Cloudinary and both Express apps together (local server and Vercel share this). */
const { buildConfig, validateConfig } = require('./config');
const { createSupabaseStore } = require('./lib/store');
const { createSupabaseAuth } = require('./lib/auth');
const { createCloudinaryStorage } = require('./lib/storage');
const { createLiveNotifier } = require('./lib/live');
const { createRateStoreFactory } = require('./lib/rate-store');
const { createPublicApp } = require('./app-public');
const { createAdminApp } = require('./app-admin');

function createRuntime(env) {
    const cfg = buildConfig(env);
    const problems = validateConfig(cfg);
    if (problems.length) {
        const err = new Error('Configuration problems: ' + problems.join('; '));
        err.problems = problems;
        throw err;
    }

    const { createClient } = require('@supabase/supabase-js');
    // Service-role client: server only, bypasses Row Level Security. Sessions are never persisted.
    const supabase = createClient(cfg.supabase.url, cfg.supabase.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    const store = createSupabaseStore(supabase);
    const auth = createSupabaseAuth(supabase);
    const storage = createCloudinaryStorage(cfg);
    const live = createLiveNotifier(cfg);
    const rateFactory = createRateStoreFactory(supabase);

    return {
        cfg,
        publicApp: createPublicApp({ cfg, store, storage, live, rateFactory }),
        adminApp: createAdminApp({ cfg, store, storage, auth, live })
    };
}

module.exports = { createRuntime };

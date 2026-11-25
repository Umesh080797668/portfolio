'use strict';

/**
 * Rate-limit counters kept in Supabase (see rate_limit_hit() in supabase/schema.sql).
 *
 * On Vercel every request may run in a different function instance, so counters kept in memory
 * would reset constantly and limit nothing. A shared counter in the database works everywhere.
 * If the database call fails we let the request through (and log), rather than lock everybody out.
 */
function createRateStoreFactory(client) {
    return function makeStore(prefix, windowMs) {
        const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
        let nowFn = () => Date.now();
        return {
            localKeys: false,
            prefix,
            init() { /* nothing to prepare */ },
            _setClock(fn) { nowFn = fn; },
            async increment(key) {
                const { data, error } = await client.rpc('rate_limit_hit', {
                    p_key: `${prefix}:${key}`,
                    p_window_seconds: windowSeconds
                });
                if (error) throw new Error(`rate limit store: ${error.message}`);
                const hits = Number(Array.isArray(data) ? data[0] : data) || 1;
                const now = nowFn();
                const resetTime = new Date(Math.ceil(now / windowMs) * windowMs);
                return { totalHits: hits, resetTime };
            },
            async decrement() { /* counters expire with their window */ },
            async resetKey() { /* not needed */ }
        };
    };
}

module.exports = { createRateStoreFactory };

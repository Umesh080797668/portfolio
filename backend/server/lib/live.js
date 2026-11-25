'use strict';

/**
 * Realtime "something changed" pings, built for serverless hosting (Vercel).
 *
 * A function that runs for only a few seconds cannot hold a live connection open, so instead:
 *   1. the server tells Supabase Realtime "order X changed" with ONE stateless HTTP call (broadcast),
 *   2. the visitor's browser listens on that order's private-by-obscurity channel and then re-fetches
 *      the order from our API. The ping carries NO data, so nothing can leak through the channel.
 *
 * The channel name is an HMAC of the order id + tracking code: unguessable, and it stops
 * working for old listeners when the code is regenerated.
 */
const crypto = require('crypto');

function createLiveNotifier(cfg, fetchImpl) {
    const doFetch = fetchImpl || fetch;
    const enabled = !!(cfg.supabase.url && cfg.supabase.serviceRoleKey);

    function channelFor(order) {
        if (!order || !order.tracking_code) return null;
        const mac = crypto.createHmac('sha256', cfg.uploadTokenSecret)
            .update(`live|${order.id}|${order.tracking_code}`).digest('hex').slice(0, 32);
        return `order-${mac}`;
    }

    /** Never throws and never blocks a response for long: realtime is a nicety, polling is the safety net. */
    async function publish(order) {
        const topic = channelFor(order);
        if (!enabled || !topic) return false;
        try {
            const res = await doFetch(`${cfg.supabase.url}/realtime/v1/api/broadcast`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: cfg.supabase.serviceRoleKey,
                    Authorization: `Bearer ${cfg.supabase.serviceRoleKey}`
                },
                body: JSON.stringify({ messages: [{ topic, event: 'change', payload: {}, private: false }] }),
                signal: AbortSignal.timeout(2500)
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    return { channelFor, publish, enabled };
}

module.exports = { createLiveNotifier };

'use strict';

/**
 * Vercel entry point. Every request (see vercel.json) lands here and is sent to the
 * public API or, on ADMIN_HOSTNAME only, to the admin dashboard.
 * Secrets come from the Vercel project's Environment Variables, never from files in Git.
 */
const { createRuntime } = require('../server/runtime');
const { createDispatcher } = require('../server/dispatch');

let handler = null; // built once per warm function instance

module.exports = (req, res) => {
    if (!handler) {
        try {
            const runtime = createRuntime();
            handler = createDispatcher(runtime);
        } catch (e) {
            // Log which settings are wrong (names only) but tell the public nothing.
            console.error('Backend is not configured:', (e.problems || [e.message]).join('; '));
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Server is not configured' }));
        }
    }
    return handler(req, res);
};

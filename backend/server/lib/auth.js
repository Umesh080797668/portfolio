'use strict';

/**
 * Verifies the Supabase Auth access token sent by the admin dashboard.
 * getUser() asks Supabase to validate the token (signature, expiry, revoked session),
 * so we never trust a token we merely decoded.
 */
function createSupabaseAuth(client) {
    return {
        async verifyToken(token) {
            const { data, error } = await client.auth.getUser(token);
            if (error || !data || !data.user) throw new Error('invalid token');

            // The token is already validated above, so reading its claims is safe.
            let aal = 'aal1';
            try {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
                if (payload && payload.aal) aal = payload.aal;
            } catch (e) { /* keep aal1 */ }

            return {
                id: data.user.id,
                email: (data.user.email || '').toLowerCase(),
                emailConfirmed: !!(data.user.email_confirmed_at || data.user.confirmed_at),
                aal
            };
        }
    };
}

module.exports = { createSupabaseAuth };

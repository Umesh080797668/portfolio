'use strict';

const { generateTrackingCode } = require('./codes');

/**
 * Data access on Supabase (PostgreSQL). This is the ONLY file that talks to the database.
 * It runs with the service-role key on the server. The tables have Row Level Security
 * enabled with no policies (see supabase/schema.sql), so the public anon key can read nothing.
 */
function createSupabaseStore(client) {
    const fail = (error, what) => {
        const err = new Error(`${what}: ${error.message}`);
        err.code = error.code;
        throw err;
    };

    const one = async (query, what) => {
        const { data, error } = await query;
        if (error) fail(error, what);
        return data;
    };

    return {
        async createOrder(order) {
            return one(client.from('work_orders').insert(order).select().single(), 'createOrder');
        },

        async getOrder(id) {
            return one(client.from('work_orders').select('*').eq('id', id).maybeSingle(), 'getOrder');
        },

        async getOrderByCode(code) {
            return one(client.from('work_orders').select('*').eq('tracking_code', code).maybeSingle(), 'getOrderByCode');
        },

        async listOrders({ status, q, limit }) {
            let query = client.from('work_orders').select('*').order('updated_at', { ascending: false }).limit(limit || 100);
            if (status) query = query.eq('status', status);
            if (q) {
                const term = q.replace(/[%,()*]/g, ' ').trim();
                if (term) {
                    query = query.or(
                        `client_name.ilike.%${term}%,client_phone.ilike.%${term}%,client_email.ilike.%${term}%,title.ilike.%${term}%,tracking_code.ilike.%${term}%`
                    );
                }
            }
            return one(query, 'listOrders');
        },

        async updateOrder(id, patch) {
            return one(
                client.from('work_orders').update(Object.assign({}, patch, { updated_at: new Date().toISOString() }))
                    .eq('id', id).select().single(),
                'updateOrder'
            );
        },

        /** Gives the order a fresh unique tracking code (retries on the rare collision). */
        async assignTrackingCode(id, extraPatch) {
            for (let attempt = 0; attempt < 6; attempt += 1) {
                const code = generateTrackingCode();
                const { data, error } = await client.from('work_orders')
                    .update(Object.assign({}, extraPatch || {}, { tracking_code: code, updated_at: new Date().toISOString() }))
                    .eq('id', id).select().single();
                if (!error) return data;
                if (error.code !== '23505') fail(error, 'assignTrackingCode');
            }
            throw new Error('assignTrackingCode: could not generate a unique code');
        },

        async deleteOrder(id) {
            await one(client.from('work_orders').delete().eq('id', id), 'deleteOrder');
        },

        async addUpdate(update) {
            return one(client.from('order_updates').insert(update).select().single(), 'addUpdate');
        },

        async listUpdates(orderId, { publicOnly } = {}) {
            let query = client.from('order_updates').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
            if (publicOnly) query = query.eq('is_public', true);
            return one(query, 'listUpdates');
        },

        async addFiles(files) {
            if (!files.length) return [];
            return one(client.from('order_files').insert(files).select(), 'addFiles');
        },

        async listFiles(orderId, visibility) {
            let query = client.from('order_files').select('*').eq('order_id', orderId).order('created_at', { ascending: true });
            if (visibility) query = query.eq('visibility', visibility);
            return one(query, 'listFiles');
        },

        async getFile(id) {
            return one(client.from('order_files').select('*').eq('id', id).maybeSingle(), 'getFile');
        },

        async audit(entry) {
            try {
                await client.from('audit_log').insert(entry);
            } catch (e) { /* never block the request because logging failed */ }
        },

        async listAudit(limit) {
            return one(client.from('audit_log').select('*').order('at', { ascending: false }).limit(limit || 100), 'listAudit');
        }
    };
}

module.exports = { createSupabaseStore };

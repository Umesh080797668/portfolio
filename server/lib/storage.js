'use strict';

/**
 * File storage on Cloudinary.
 *
 * - Visitors upload DIRECTLY to Cloudinary using a short-lived signature made here,
 *   so the API secret never leaves the server and large files never pass through it.
 * - Everything is stored with type "authenticated" = private. There is no public URL;
 *   downloads happen through expiring links created by the server.
 */
const crypto = require('crypto');

/** "My Report (final).PDF" -> "my_report_final.pdf" (keeps the extension, safe for a storage key). */
function safeFileName(name) {
    const raw = String(name || 'file').normalize('NFKD');
    const m = /\.([a-zA-Z0-9]{1,10})$/.exec(raw);
    const ext = m ? m[1].toLowerCase() : '';
    const base = (m ? raw.slice(0, -m[0].length) : raw)
        .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 40) || 'file';
    return ext ? `${base}.${ext}` : base;
}

function createCloudinaryStorage(cfg) {
    const { v2: cloudinary } = require('cloudinary');
    cloudinary.config({
        cloud_name: cfg.cloudinary.cloudName,
        api_key: cfg.cloudinary.apiKey,
        api_secret: cfg.cloudinary.apiSecret,
        secure: true
    });

    return {
        /**
         * Parameters the browser must send to Cloudinary, plus the signature.
         * The server picks the exact public_id (folder + random prefix + safe file name), so the
         * browser cannot choose where a file goes or overwrite another file. Using public_id
         * (instead of the "folder" parameter) behaves the same in fixed and dynamic folder modes.
         */
        signUpload(folder, fileName) {
            const params = {
                overwrite: 'false',
                public_id: `${folder}/${crypto.randomBytes(4).toString('hex')}_${safeFileName(fileName)}`,
                timestamp: Math.floor(Date.now() / 1000),
                type: 'authenticated'
            };
            const signature = cloudinary.utils.api_sign_request(params, cfg.cloudinary.apiSecret);
            return {
                uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.cloudinary.cloudName}/auto/upload`,
                fields: Object.assign({}, params, { api_key: cfg.cloudinary.apiKey, signature })
            };
        },

        /** Ask Cloudinary what really exists, instead of trusting the browser. */
        async inspect(publicId, resourceType) {
            try {
                const r = await cloudinary.api.resource(publicId, { resource_type: resourceType, type: 'authenticated' });
                return {
                    publicId: r.public_id,
                    resourceType: r.resource_type,
                    format: r.format || '',
                    bytes: r.bytes || 0,
                    originalName: r.original_filename || ''
                };
            } catch (e) {
                return null;
            }
        },

        /** Expiring download link (default 10 minutes). */
        downloadUrl(file, ttlSeconds) {
            const expiresAt = Math.floor(Date.now() / 1000) + (ttlSeconds || 600);
            const format = file.resource_type === 'raw' ? '' : (file.format || '');
            return cloudinary.utils.private_download_url(file.public_id, format, {
                resource_type: file.resource_type,
                type: 'authenticated',
                attachment: true,
                expires_at: expiresAt
            });
        },

        async remove(files) {
            const groups = {};
            files.forEach((f) => { (groups[f.resource_type] = groups[f.resource_type] || []).push(f.public_id); });
            for (const type of Object.keys(groups)) {
                try {
                    await cloudinary.api.delete_resources(groups[type], { resource_type: type, type: 'authenticated' });
                } catch (e) { /* best effort */ }
            }
        }
    };
}

module.exports = { createCloudinaryStorage, safeFileName };

'use strict';

const { verifyUploadToken, isBlockedFileName, displayFileName } = require('./security');

const STATUSES = [
    'pending_review', 'accepted', 'in_progress', 'awaiting_client',
    'ready_for_delivery', 'completed', 'on_hold', 'cancelled', 'rejected'
];

// Statuses an admin may choose in the update form (review/reject have their own actions)
const UPDATABLE_STATUSES = STATUSES.filter((s) => s !== 'pending_review' && s !== 'rejected');

const CLOSED_STATUSES = ['cancelled', 'rejected'];

const MAX_CLIENT_FILES_PER_ORDER = 40;

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/** What a visitor with a tracking code is allowed to see. No contact details, no internal notes. */
function toPublicView(order, updates, files) {
    return {
        code: order.tracking_code,
        title: order.title,
        clientFirstName: String(order.client_name || '').split(/\s+/)[0] || '',
        status: order.status,
        progress: order.progress,
        dueDate: order.due_date || null,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        acceptingFiles: !CLOSED_STATUSES.includes(order.status),
        timeline: updates
            .filter((u) => u.is_public)
            .map((u) => ({ status: u.status, progress: u.progress, message: u.message, at: u.created_at })),
        deliverables: files
            .filter((f) => f.visibility === 'deliverable')
            .map((f) => ({ id: f.id, name: f.original_name, bytes: f.bytes }))
    };
}

/**
 * Checks files the browser says it uploaded. The browser is NOT trusted:
 *  - the folder token must have been issued by this server,
 *  - the file must live inside that folder,
 *  - Cloudinary must confirm it exists, its real size and its real type.
 * Anything wrong is deleted from storage and rejected.
 */
async function verifyUploads({ cfg, storage, descriptors, folderAllowed }) {
    const seen = new Set();
    const verified = [];
    const rejectAll = async (message) => {
        await storage.remove(verified.map((v) => ({ public_id: v.public_id, resource_type: v.resource_type })));
        throw new HttpError(400, message);
    };

    if (descriptors.length > cfg.limits.maxFiles) {
        throw new HttpError(400, `You can send up to ${cfg.limits.maxFiles} files at a time.`);
    }

    for (const d of descriptors) {
        if (seen.has(d.publicId)) continue;
        seen.add(d.publicId);

        if (!folderAllowed(d.folder)
            || !verifyUploadToken(cfg.uploadTokenSecret, d.folder, d.token)
            || !d.publicId.startsWith(`${d.folder}/`)) {
            await rejectAll('A file could not be verified. Please upload it again.');
        }

        const info = await storage.inspect(d.publicId, d.resourceType);
        if (!info) await rejectAll('A file upload did not finish. Please try again.');

        const keyName = info.publicId.split('/').pop();
        const name = keyName;
        if (info.bytes > cfg.limits.maxFileBytes) {
            await storage.remove([{ public_id: info.publicId, resource_type: info.resourceType }]);
            await rejectAll(`Files must be smaller than ${Math.round(cfg.limits.maxFileBytes / 1048576)} MB.`);
        }
        if (isBlockedFileName(name) || isBlockedFileName(info.publicId) || isBlockedFileName(`x.${info.format}`)) {
            await storage.remove([{ public_id: info.publicId, resource_type: info.resourceType }]);
            await rejectAll('This file type is not allowed.');
        }

        verified.push({
            public_id: info.publicId,
            resource_type: info.resourceType,
            format: info.format,
            bytes: info.bytes,
            original_name: displayFileName(keyName.replace(/^[a-f0-9]{8}_/, ''))
        });
    }
    return verified;
}

module.exports = {
    STATUSES,
    UPDATABLE_STATUSES,
    CLOSED_STATUSES,
    MAX_CLIENT_FILES_PER_ORDER,
    HttpError,
    toPublicView,
    verifyUploads
};

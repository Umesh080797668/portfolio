'use strict';

const { z } = require('zod');
const { UPDATABLE_STATUSES } = require('./orders');

const text = (min, max) => z.string().trim().min(min).max(max);
const optText = (max) => z.string().trim().max(max).optional().default('');
const phone = z.string().trim().regex(/^[0-9+()\-\s]{7,30}$/, 'Invalid phone number').or(z.literal('')).optional().default('');
const email = z.string().trim().max(120).pipe(z.email()).or(z.literal('')).optional().default('');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const uploadDescriptor = z.object({
    publicId: z.string().min(3).max(300),
    resourceType: z.enum(['image', 'raw', 'video']),
    folder: z.string().min(3).max(300),
    token: z.string().min(10).max(300)
});

const quote = z.object({
    no: text(1, 40),
    total: z.number().min(0).max(1e9),
    lines: z.array(z.object({
        name: text(1, 120),
        qty: z.number().min(0).max(9999),
        amount: z.number().min(0).max(1e9).nullable()
    })).max(40)
});

const needsContact = (d) => !!(d.phone || d.email);
const contactMessage = { message: 'Please give a phone/WhatsApp number or an e-mail address', path: ['phone'] };

const schemas = {
    signUpload: z.object({
        fileName: text(1, 200),
        size: z.number().int().min(1),
        code: z.string().max(40).optional(),
        folder: z.string().max(300).optional(),
        token: z.string().max(300).optional()
    }),

    submitRequest: z.object({
        name: text(2, 80),
        phone,
        email,
        org: optText(80),
        title: text(3, 150),
        details: optText(2000),
        files: z.array(uploadDescriptor).max(20).default([]),
        quote: quote.optional(),
        consent: z.literal(true, { message: 'Please confirm that you agree to share these details' }),
        website: z.string().max(200).optional().default('') // honeypot
    }).refine(needsContact, contactMessage),

    clientFiles: z.object({
        files: z.array(uploadDescriptor).min(1).max(20)
    }),

    adminCreateOrder: z.object({
        name: text(2, 80),
        phone,
        email,
        org: optText(80),
        title: text(3, 150),
        details: optText(2000),
        source: z.enum(['whatsapp', 'email', 'phone', 'portfolio', 'other']).default('whatsapp'),
        quoteNo: optText(40),
        quoteTotal: z.number().min(0).max(1e9).nullable().optional(),
        dueDate: dateOnly.nullable().optional(),
        internalNotes: optText(4000),
        issueCode: z.boolean().default(true)
    }).refine(needsContact, contactMessage),

    adminPatchOrder: z.object({
        name: text(2, 80).optional(),
        phone: phone.optional(),
        email: email.optional(),
        org: z.string().trim().max(80).optional(),
        title: text(3, 150).optional(),
        details: z.string().trim().max(2000).optional(),
        quoteNo: z.string().trim().max(40).optional(),
        quoteTotal: z.number().min(0).max(1e9).nullable().optional(),
        dueDate: dateOnly.nullable().optional(),
        internalNotes: z.string().trim().max(4000).optional()
    }).refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' }),

    adminAddUpdate: z.object({
        status: z.enum(UPDATABLE_STATUSES).optional(),
        progress: z.number().int().min(0).max(100).optional(),
        message: z.string().trim().max(1000).optional().default(''),
        isPublic: z.boolean().default(true),
        dueDate: dateOnly.nullable().optional()
    }).refine((d) => d.status || d.progress !== undefined || d.message || d.dueDate !== undefined,
        { message: 'Provide a status, progress, due date or message' }),

    adminReject: z.object({
        reason: optText(500)
    }),

    adminSign: z.object({
        fileName: text(1, 200),
        size: z.number().int().min(1),
        folder: z.string().max(300).optional(),
        token: z.string().max(300).optional()
    }),

    adminRegisterFiles: z.object({
        files: z.array(uploadDescriptor).min(1).max(20)
    })
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = { schemas, UUID };

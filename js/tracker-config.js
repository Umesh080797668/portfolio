/**
 * TECHASSIST LK - TRACKER & CLOUD STORAGE CONFIGURATION
 * 
 * To activate live Cloudinary and Supabase backends:
 * 1. Cloudinary: Create a free account on https://cloudinary.com
 *    - Cloud Name: Found in Dashboard
 *    - Upload Preset: Go to Settings -> Upload -> Upload presets -> Add unsigned preset.
 * 2. Supabase: Create a free project on https://supabase.com
 *    - Run the SQL script from `supabase_schema.sql` in Supabase SQL Editor.
 *    - Copy Project URL and Public Anon Key from Settings -> API.
 * 
 * NOTE: If credentials are left blank or default, the tracker runs in
 * offline/localStorage fallback mode with simulated uploads and real-time events!
 */

window.TRACKER_CONFIG = {
    // Cloudinary Storage Config (for PDFs, Excels, Word docs, TXT, images, ZIPs)
    cloudinary: {
        cloudName: '',             // e.g. 'dxy123abc' (leave empty to use local preview fallback)
        uploadPreset: '',          // e.g. 'techassist_unsigned'
        folder: 'techassist_lk/tasks',
        maxFileSizeMB: 25,
        allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf', 'zip', 'rar', 'png', 'jpg', 'jpeg', 'webp']
    },

    // Supabase Database & Realtime Config
    supabase: {
        url: '',                   // e.g. 'https://xyzabcdefg.supabase.co'
        anonKey: ''                // e.g. 'eyJhbGciOiJIUzI1NiIsIn...'
    },

    // Admin Tracker Portal Config
    admin: {
        // Default PIN to unlock Admin Work Tracker (Change as desired)
        pin: '2026',
        whatsappNumber: '94704124816',
        ownerName: 'Imantha Umesh',
        brandName: 'TechAssist LK'
    },

    // Tracking Code generator prefix
    trackingPrefix: 'TRK',

    // Status definitions & display meta
    stages: [
        { key: 'submitted', label: 'Request Received', icon: 'fa-clipboard-check', desc: 'Task & files safely logged.' },
        { key: 'reviewing', label: 'Assessment & Scope', icon: 'fa-magnifying-glass', desc: 'Reviewing requirements & timeline.' },
        { key: 'in_progress', label: 'In Progress', icon: 'fa-laptop-code', desc: 'Active work / development ongoing.' },
        { key: 'quality_polish', label: 'Review & Polish', icon: 'fa-circle-check', desc: 'Final testing, quality check & verification.' },
        { key: 'completed', label: 'Ready & Delivered', icon: 'fa-rocket', desc: 'Work complete. Deliverables ready!' }
    ]
};


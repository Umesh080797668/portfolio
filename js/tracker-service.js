/**
 * TECHASSIST LK - TASK TRACKING & CLOUD STORAGE SERVICE
 * 
 * Manages:
 * 1. Cloudinary direct file uploads (PDF, Excel, Word, TXT, images, ZIP) with fallback
 * 2. Supabase Database integration with Realtime synchronization
 * 3. LocalStorage persistence fallback for offline or zero-config operation
 */

(function (window) {
    'use strict';

    const CONFIG = window.TRACKER_CONFIG || {
        cloudinary: { cloudName: '', uploadPreset: '', folder: 'techassist_lk/tasks', maxFileSizeMB: 25 },
        supabase: { url: '', anonKey: '' },
        admin: { pin: '2026', whatsappNumber: '94704124816' },
        trackingPrefix: 'TRK'
    };

    const LOCAL_STORE_KEY = 'tal_tasks_store_v1';
    let supabaseClient = null;

    // Initialize Supabase if credentials are provided and library is present
    function initSupabase() {
        if (window.supabase && CONFIG.supabase.url && CONFIG.supabase.anonKey &&
            CONFIG.supabase.url.startsWith('http') && !CONFIG.supabase.url.includes('xyzabcdefg')) {
            try {
                supabaseClient = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
                console.log('✅ Supabase initialized successfully for TechAssist Tracker');
            } catch (err) {
                console.warn('⚠️ Supabase init failed, falling back to LocalStorage:', err);
                supabaseClient = null;
            }
        } else {
            // Running in LocalStorage fallback mode
            supabaseClient = null;
        }
    }

    // Initialize demo seed in localStorage if empty
    function ensureSeedData() {
        try {
            const raw = localStorage.getItem(LOCAL_STORE_KEY);
            if (!raw) {
                const demoTasks = [
                    {
                        id: 'demo-1',
                        tracking_code: 'TRK-DEMO-2026',
                        client_name: 'Kavindu Perera',
                        client_phone: '+94 77 123 4567',
                        client_email: 'kavindu@example.com',
                        service_title: 'University Project & Excel Automation',
                        service_category: 'academic',
                        budget: 15000,
                        urgency: 'priority',
                        status: 'in_progress',
                        progress_percent: 65,
                        eta_date: new Date(Date.now() + 86400000 * 2).toISOString(),
                        notes: 'Final semester assessment dataset cleaning and statistical analysis script.',
                        deliverable_url: '',
                        deliverable_notes: 'Draft data tables ready. Finishing visual summary charts.',
                        files: [
                            { name: 'project_brief.pdf', size: '1.4 MB', format: 'pdf', url: 'javascript:alert("Sample file download preview")' },
                            { name: 'survey_data.xlsx', size: '640 KB', format: 'xlsx', url: 'javascript:alert("Sample file download preview")' }
                        ],
                        updates: [
                            {
                                id: 'up-1',
                                title: 'Requirements Verified',
                                message: 'Reviewed assignment guidelines and dataset scope. Budget approved.',
                                status_tag: 'reviewing',
                                created_at: new Date(Date.now() - 86400000 * 2).toISOString()
                            },
                            {
                                id: 'up-2',
                                title: 'Excel Cleaning & Formulas Completed',
                                message: 'Cleaned raw survey data, formatted pivot tables, and verified formulas.',
                                status_tag: 'in_progress',
                                created_at: new Date(Date.now() - 86400000 * 1).toISOString()
                            }
                        ],
                        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ];
                localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(demoTasks));
            }
        } catch (e) {
            console.error('Storage access error:', e);
        }
    }

    // Generate unique tracking code: TRK-YYYY-XXXXX
    function generateTrackingCode() {
        const year = new Date().getFullYear();
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${CONFIG.trackingPrefix || 'TRK'}-${year}-${code}`;
    }

    // Determine file format and icon
    function getFileInfo(fileName) {
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        let icon = 'fa-file';
        let color = '#8b949e';
        let label = ext.toUpperCase();

        if (['pdf'].includes(ext)) {
            icon = 'fa-file-pdf';
            color = '#f85149';
        } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
            icon = 'fa-file-excel';
            color = '#3fb950';
        } else if (['doc', 'docx', 'rtf'].includes(ext)) {
            icon = 'fa-file-word';
            color = '#58a6ff';
        } else if (['txt', 'md'].includes(ext)) {
            icon = 'fa-file-lines';
            color = '#d29922';
        } else if (['zip', 'rar', '7z', 'tar'].includes(ext)) {
            icon = 'fa-file-zipper';
            color = '#f0883e';
        } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
            icon = 'fa-file-image';
            color = '#bc8cff';
        } else if (['js', 'py', 'java', 'html', 'css', 'sql'].includes(ext)) {
            icon = 'fa-file-code';
            color = '#58a6ff';
        }

        return { ext, icon, color, label };
    }

    // Format byte size to readable string
    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /* ------------------------------------------------------------
       CLOUDINARY FILE UPLOAD
    ------------------------------------------------------------ */
    async function uploadSingleFileToCloudinary(file, onProgress) {
        const cloudName = CONFIG.cloudinary?.cloudName;
        const uploadPreset = CONFIG.cloudinary?.uploadPreset;

        // If credentials are configured, upload to live Cloudinary
        if (cloudName && uploadPreset && cloudName !== 'your_cloud_name') {
            const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', uploadPreset);
            if (CONFIG.cloudinary.folder) {
                formData.append('folder', CONFIG.cloudinary.folder);
            }

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable && onProgress) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        onProgress(percent);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const res = JSON.parse(xhr.responseText);
                            const info = getFileInfo(file.name);
                            resolve({
                                name: file.name,
                                size: formatBytes(file.size),
                                format: info.ext,
                                url: res.secure_url || res.url,
                                public_id: res.public_id,
                                is_cloud: true
                            });
                        } catch (err) {
                            reject(err);
                        }
                    } else {
                        reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error during file upload'));
                xhr.send(formData);
            });
        }

        // FALLBACK: Simulate upload & create simulated local file URL
        return new Promise((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += 25;
                if (onProgress) onProgress(Math.min(progress, 100));
                if (progress >= 100) {
                    clearInterval(interval);
                    const info = getFileInfo(file.name);

                    // Create blob URL for in-session preview
                    let localUrl = '#';
                    try {
                        localUrl = URL.createObjectURL(file);
                    } catch (e) {
                        localUrl = '#';
                    }

                    resolve({
                        name: file.name,
                        size: formatBytes(file.size),
                        format: info.ext,
                        url: localUrl,
                        is_simulated: true
                    });
                }
            }, 100);
        });
    }

    // Upload an array of files
    async function uploadFiles(fileList, onProgressItem) {
        const results = [];
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const uploaded = await uploadSingleFileToCloudinary(file, (percent) => {
                if (onProgressItem) onProgressItem(i, percent, file.name);
            });
            results.push(uploaded);
        }
        return results;
    }

    /* ------------------------------------------------------------
       DATABASE OPERATIONS (Supabase + LocalStorage Fallback)
    ------------------------------------------------------------ */

    // Helper: Local storage accessor
    function getLocalTasks() {
        try {
            return JSON.parse(localStorage.getItem(LOCAL_STORE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveLocalTasks(tasks) {
        try {
            localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(tasks));
            window.dispatchEvent(new CustomEvent('tal_task_updated', { detail: { timestamp: Date.now() } }));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }

    // Create a new task
    async function createTask(taskData) {
        const trackingCode = taskData.tracking_code || generateTrackingCode();
        const now = new Date().toISOString();

        const taskRecord = {
            id: taskData.id || ('task-' + Date.now()),
            tracking_code: trackingCode.toUpperCase().trim(),
            client_name: taskData.client_name || 'Anonymous Client',
            client_phone: taskData.client_phone || '',
            client_email: taskData.client_email || '',
            client_org: taskData.client_org || '',
            service_title: taskData.service_title || 'General IT Support / Assessment',
            service_category: taskData.service_category || 'general',
            budget: taskData.budget ? Number(taskData.budget) : null,
            budget_note: taskData.budget_note || '',
            urgency: taskData.urgency || 'standard',
            status: taskData.status || 'submitted',
            progress_percent: taskData.progress_percent != null ? Number(taskData.progress_percent) : 15,
            notes: taskData.notes || '',
            deliverable_url: taskData.deliverable_url || '',
            deliverable_notes: taskData.deliverable_notes || '',
            eta_date: taskData.eta_date || null,
            files: Array.isArray(taskData.files) ? taskData.files : [],
            updates: [
                {
                    id: 'up-' + Date.now(),
                    title: 'Task Received',
                    message: taskData.initial_update_message || 'Task & attached files logged successfully in the system.',
                    status_tag: 'submitted',
                    created_at: now
                }
            ],
            created_at: now,
            updated_at: now
        };

        // If Supabase is active
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('tasks')
                    .insert([{
                        tracking_code: taskRecord.tracking_code,
                        client_name: taskRecord.client_name,
                        client_phone: taskRecord.client_phone,
                        client_email: taskRecord.client_email,
                        client_org: taskRecord.client_org,
                        service_title: taskRecord.service_title,
                        service_category: taskRecord.service_category,
                        budget: taskRecord.budget,
                        budget_note: taskRecord.budget_note,
                        urgency: taskRecord.urgency,
                        status: taskRecord.status,
                        progress_percent: taskRecord.progress_percent,
                        notes: taskRecord.notes,
                        deliverable_url: taskRecord.deliverable_url,
                        deliverable_notes: taskRecord.deliverable_notes,
                        eta_date: taskRecord.eta_date,
                        files: taskRecord.files
                    }])
                    .select()
                    .single();

                if (error) throw error;

                // Insert initial update
                await supabaseClient.from('task_updates').insert([{
                    tracking_code: taskRecord.tracking_code,
                    title: 'Task Received',
                    message: taskData.initial_update_message || 'Task & files registered.',
                    status_tag: 'submitted'
                }]);

                // Also update local copy for offline cache
                const local = getLocalTasks();
                local.unshift(taskRecord);
                saveLocalTasks(local);

                return taskRecord;
            } catch (err) {
                console.warn('Supabase insert failed, saving to LocalStorage fallback:', err);
            }
        }

        // Local fallback
        const tasks = getLocalTasks();
        tasks.unshift(taskRecord);
        saveLocalTasks(tasks);
        return taskRecord;
    }

    // Get a task by tracking code
    async function getTask(trackingCode) {
        if (!trackingCode) return null;
        const cleanCode = trackingCode.trim().toUpperCase();

        if (supabaseClient) {
            try {
                const { data: task, error } = await supabaseClient
                    .from('tasks')
                    .select('*')
                    .ilike('tracking_code', cleanCode)
                    .single();

                if (!error && task) {
                    // Fetch updates
                    const { data: updates } = await supabaseClient
                        .from('task_updates')
                        .select('*')
                        .ilike('tracking_code', cleanCode)
                        .order('created_at', { ascending: false });

                    task.updates = updates || [];
                    return task;
                }
            } catch (err) {
                console.warn('Supabase fetch failed, trying local store:', err);
            }
        }

        // Local lookup
        const tasks = getLocalTasks();
        const found = tasks.find(t => (t.tracking_code || '').toUpperCase() === cleanCode);
        return found || null;
    }

    // Get all tasks (for Admin Work Tracker)
    async function getAllTasks() {
        if (supabaseClient) {
            try {
                const { data: tasks, error } = await supabaseClient
                    .from('tasks')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && tasks) {
                    return tasks;
                }
            } catch (err) {
                console.warn('Supabase fetch all failed, trying local store:', err);
            }
        }

        return getLocalTasks();
    }

    // Update task status and progress
    async function updateTask(trackingCode, updates) {
        if (!trackingCode) return null;
        const cleanCode = trackingCode.trim().toUpperCase();
        const now = new Date().toISOString();

        if (supabaseClient) {
            try {
                const updatePayload = { ...updates, updated_at: now };
                const { data, error } = await supabaseClient
                    .from('tasks')
                    .update(updatePayload)
                    .ilike('tracking_code', cleanCode)
                    .select()
                    .single();

                if (error) throw error;
            } catch (err) {
                console.warn('Supabase update failed:', err);
            }
        }

        // Local update
        const tasks = getLocalTasks();
        const idx = tasks.findIndex(t => (t.tracking_code || '').toUpperCase() === cleanCode);
        if (idx !== -1) {
            tasks[idx] = { ...tasks[idx], ...updates, updated_at: now };
            saveLocalTasks(tasks);
            return tasks[idx];
        }
        return null;
    }

    // Add a progress update / milestone note to a task
    async function addTaskUpdate(trackingCode, updateData) {
        if (!trackingCode) return null;
        const cleanCode = trackingCode.trim().toUpperCase();
        const now = new Date().toISOString();

        const updateItem = {
            id: 'up-' + Date.now(),
            tracking_code: cleanCode,
            title: updateData.title || 'Status Update',
            message: updateData.message || '',
            status_tag: updateData.status_tag || 'in_progress',
            created_at: now
        };

        if (supabaseClient) {
            try {
                await supabaseClient.from('task_updates').insert([updateItem]);
            } catch (err) {
                console.warn('Supabase add update note failed:', err);
            }
        }

        // Local update
        const tasks = getLocalTasks();
        const idx = tasks.findIndex(t => (t.tracking_code || '').toUpperCase() === cleanCode);
        if (idx !== -1) {
            if (!Array.isArray(tasks[idx].updates)) {
                tasks[idx].updates = [];
            }
            tasks[idx].updates.unshift(updateItem);
            tasks[idx].updated_at = now;
            if (updateData.status_tag) {
                tasks[idx].status = updateData.status_tag;
            }
            if (updateData.progress_percent != null) {
                tasks[idx].progress_percent = Number(updateData.progress_percent);
            }
            saveLocalTasks(tasks);
            return tasks[idx];
        }
        return null;
    }

    // Delete a task (Admin action)
    async function deleteTask(trackingCode) {
        if (!trackingCode) return false;
        const cleanCode = trackingCode.trim().toUpperCase();

        if (supabaseClient) {
            try {
                await supabaseClient.from('tasks').delete().ilike('tracking_code', cleanCode);
            } catch (err) {
                console.warn('Supabase delete failed:', err);
            }
        }

        const tasks = getLocalTasks();
        const filtered = tasks.filter(t => (t.tracking_code || '').toUpperCase() !== cleanCode);
        saveLocalTasks(filtered);
        return true;
    }

    // Realtime subscription listener
    function subscribeToTask(trackingCode, onUpdate) {
        if (!trackingCode) return () => { };
        const cleanCode = trackingCode.trim().toUpperCase();

        // 1. Supabase Realtime channel
        let channel = null;
        if (supabaseClient && supabaseClient.channel) {
            try {
                channel = supabaseClient
                    .channel(`task-${cleanCode}`)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'tasks', filter: `tracking_code=eq.${cleanCode}` },
                        async (payload) => {
                            const updated = await getTask(cleanCode);
                            if (onUpdate && updated) onUpdate(updated);
                        }
                    )
                    .on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'task_updates', filter: `tracking_code=eq.${cleanCode}` },
                        async () => {
                            const updated = await getTask(cleanCode);
                            if (onUpdate && updated) onUpdate(updated);
                        }
                    )
                    .subscribe();
            } catch (e) {
                console.warn('Supabase subscription error:', e);
            }
        }

        // 2. Local storage listener
        const localHandler = (e) => {
            getTask(cleanCode).then(task => {
                if (task && onUpdate) onUpdate(task);
            });
        };
        window.addEventListener('tal_task_updated', localHandler);
        window.addEventListener('storage', localHandler);

        // Return unsubscribe function
        return () => {
            if (channel && supabaseClient) {
                supabaseClient.removeChannel(channel);
            }
            window.removeEventListener('tal_task_updated', localHandler);
            window.removeEventListener('storage', localHandler);
        };
    }

    // Generate WhatsApp Message with Tracking Link
    function buildWhatsAppTrackingMessage(task) {
        const domain = window.location.origin + window.location.pathname.replace(/\/index\.html$/, '/services.html');
        const trackingUrl = `${domain}?track=${encodeURIComponent(task.tracking_code)}`;

        const lines = [
            `👋 *Hello ${task.client_name}*,`,
            ``,
            `Your task/assessment has been logged with *${CONFIG.admin.brandName || 'TechAssist LK'}*!`,
            ``,
            `📌 *Task:* ${task.service_title}`,
            `🔑 *Tracking Code:* *${task.tracking_code}*`,
            `📊 *Current Status:* ${task.status.toUpperCase().replace(/_/g, ' ')} (${task.progress_percent}%)`,
            ``,
            `🔗 *Track Real-Time Progress & Download Deliverables Here:*`,
            `${trackingUrl}`,
            ``,
            `Feel free to reach out anytime if you have any questions!`
        ];

        return lines.join('\n');
    }

    // Initialize service
    initSupabase();
    ensureSeedData();

    // Export API
    window.TrackerService = {
        generateTrackingCode,
        getFileInfo,
        formatBytes,
        uploadFiles,
        createTask,
        getTask,
        getAllTasks,
        updateTask,
        addTaskUpdate,
        deleteTask,
        subscribeToTask,
        buildWhatsAppTrackingMessage,
        isSupabaseActive: () => !!supabaseClient
    };

})(window);

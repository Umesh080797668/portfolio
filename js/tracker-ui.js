/**
 * TECHASSIST LK - TASK TRACKER UI CONTROLLER
 * 
 * Handles:
 * - File upload dropzone & chip rendering (PDF, Excel, TXT, Word, ZIP, Images)
 * - Visitor Work Tracker lookup & Realtime Stepper / Progress display
 * - Admin Work Tracker Modal (PIN protection, Task Manager, Quick WhatsApp Task Creator)
 */

(function (window, document) {
    'use strict';

    const CONFIG = window.TRACKER_CONFIG || {
        admin: { pin: '2026', whatsappNumber: '94704124816' },
        stages: [
            { key: 'submitted', label: 'Request Received' },
            { key: 'reviewing', label: 'Assessment & Scope' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'quality_polish', label: 'Review & Polish' },
            { key: 'completed', label: 'Ready & Delivered' }
        ]
    };

    // State
    const state = {
        attachedFiles: [],           // Files attached to the quote/contact form
        currentTrackedCode: null,    // Currently viewed tracking code
        activeSubscription: null,   // Supabase / Local realtime unlistener
        isAdminUnlocked: false
    };

    /* ------------------------------------------------------------
       Toast notification helper
    ------------------------------------------------------------ */
    function showToast(msg, icon = 'fa-check-circle') {
        let toast = document.getElementById('tracker-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'tracker-toast';
            toast.className = 'tracker-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    /* ------------------------------------------------------------
       1. File Upload Dropzone
    ------------------------------------------------------------ */
    function initFileUploadDropzone() {
        const dropzones = document.querySelectorAll('.file-dropzone');
        const fileInputs = document.querySelectorAll('.file-hidden-input');

        dropzones.forEach(dropzone => {
            const targetInputId = dropzone.getAttribute('data-target-input');
            const input = document.getElementById(targetInputId) || dropzone.querySelector('input[type="file"]');
            const listContainer = document.getElementById(dropzone.getAttribute('data-target-list'));

            if (!input) return;

            // Click dropzone triggers input
            dropzone.addEventListener('click', (e) => {
                if (e.target !== input) input.click();
            });

            // Drag and drop events
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.remove('dragover');
                });
            });

            dropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files && files.length) {
                    handleFilesAdded(files, listContainer);
                }
            });

            input.addEventListener('change', (e) => {
                if (input.files && input.files.length) {
                    handleFilesAdded(input.files, listContainer);
                    input.value = ''; // Reset input so same file can be re-selected if needed
                }
            });
        });
    }

    async function handleFilesAdded(fileList, listContainer) {
        if (!fileList || !fileList.length) return;

        showToast(`Processing ${fileList.length} file(s)...`, 'fa-cloud-arrow-up');

        try {
            // Upload through TrackerService (Cloudinary or preview fallback)
            const uploaded = await window.TrackerService.uploadFiles(Array.from(fileList));

            uploaded.forEach(f => state.attachedFiles.push(f));
            renderAttachedFileList(listContainer);
            showToast('Files attached successfully!', 'fa-check');
        } catch (err) {
            console.error('File upload failed:', err);
            showToast('File upload failed. Please try again.', 'fa-triangle-exclamation');
        }
    }

    function renderAttachedFileList(container) {
        if (!container) return;
        container.innerHTML = '';

        if (!state.attachedFiles.length) return;

        state.attachedFiles.forEach((file, index) => {
            const info = window.TrackerService.getFileInfo(file.name);
            const chip = document.createElement('div');
            chip.className = 'file-chip';
            chip.innerHTML = `
                <div class="file-chip-left">
                    <i class="fas ${info.icon} file-chip-icon" style="color: ${info.color}"></i>
                    <div class="file-chip-info">
                        <div class="file-chip-name" title="${file.name}">${file.name}</div>
                        <div class="file-chip-meta">${file.size || 'Unknown size'} · ${info.label}</div>
                    </div>
                </div>
                <button type="button" class="file-chip-remove" title="Remove file" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;

            chip.querySelector('.file-chip-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                state.attachedFiles.splice(index, 1);
                renderAttachedFileList(container);
            });

            container.appendChild(chip);
        });
    }

    /* ------------------------------------------------------------
       2. Visitor Work Tracker Section
    ------------------------------------------------------------ */
    function initVisitorTracker() {
        const trackForm = document.getElementById('track-form');
        const trackInput = document.getElementById('track-code-input');
        const demoChips = document.querySelectorAll('.track-demo-chip');

        if (trackForm) {
            trackForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const code = trackInput ? trackInput.value.trim() : '';
                if (code) {
                    performTrackingLookup(code);
                } else {
                    showToast('Please enter your tracking code.', 'fa-circle-exclamation');
                }
            });
        }

        // Demo tracking code chip click
        demoChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const code = chip.getAttribute('data-code') || chip.textContent.trim();
                if (trackInput) trackInput.value = code;
                performTrackingLookup(code);
            });
        });

        // Auto-detect ?track=TRK-... in URL
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('track') || params.get('trk');
        if (urlCode) {
            if (trackInput) trackInput.value = urlCode;
            setTimeout(() => performTrackingLookup(urlCode), 300);
        }
    }

    async function performTrackingLookup(trackingCode) {
        const cleanCode = trackingCode.trim().toUpperCase();
        const resultWrapper = document.getElementById('track-result-wrapper');
        const btn = document.getElementById('btn-track-code');

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Checking...';
        }

        try {
            const task = await window.TrackerService.getTask(cleanCode);

            if (!task) {
                showToast(`No assessment found with code "${cleanCode}". Please check your code.`, 'fa-circle-exclamation');
                if (resultWrapper) resultWrapper.classList.remove('active');
                return;
            }

            // Cleanup previous realtime listener if switching codes
            if (state.activeSubscription) {
                state.activeSubscription();
                state.activeSubscription = null;
            }

            state.currentTrackedCode = cleanCode;

            // Render result
            renderTrackingResult(task);

            // Subscribe to live updates for this task!
            state.activeSubscription = window.TrackerService.subscribeToTask(cleanCode, (updatedTask) => {
                renderTrackingResult(updatedTask);
                showToast('Status updated in real-time!', 'fa-bolt');
            });

            if (resultWrapper) {
                resultWrapper.classList.add('active');
                resultWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

        } catch (err) {
            console.error('Tracking lookup error:', err);
            showToast('Unable to fetch tracking details. Please try again.', 'fa-circle-exclamation');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>Track Status</span> <i class="fas fa-arrow-right"></i>';
            }
        }
    }

    function renderTrackingResult(task) {
        const resultWrapper = document.getElementById('track-result-wrapper');
        if (!resultWrapper) return;

        const stageOrder = ['submitted', 'reviewing', 'in_progress', 'quality_polish', 'completed'];
        const currentStageIndex = stageOrder.indexOf(task.status) !== -1 ? stageOrder.indexOf(task.status) : 0;
        const progressPercent = task.progress_percent != null ? task.progress_percent : 15;

        // Privacy anonymization for client name (e.g. "Kavindu P.")
        let clientDisplayName = 'Client';
        if (task.client_name) {
            const parts = task.client_name.trim().split(' ');
            clientDisplayName = parts[0] + (parts.length > 1 ? ' ' + parts[parts.length - 1][0] + '.' : '');
        }

        // Stepper HTML
        const stepperHtml = CONFIG.stages.map((stage, idx) => {
            let stateClass = '';
            let iconMarkup = `<i class="fas ${stage.icon}"></i>`;

            if (idx < currentStageIndex) {
                stateClass = 'completed';
                iconMarkup = '<i class="fas fa-check"></i>';
            } else if (idx === currentStageIndex) {
                stateClass = 'active';
            }

            return `
                <div class="step-item ${stateClass}">
                    <div class="step-icon-box">${iconMarkup}</div>
                    <div class="step-label">${stage.label}</div>
                    <div class="step-sub">${stage.desc || ''}</div>
                </div>
            `;
        }).join('');

        // Deliverable Banner HTML (if ready)
        let deliverableHtml = '';
        if (task.status === 'completed' || task.deliverable_url) {
            deliverableHtml = `
                <div class="deliverable-banner">
                    <div class="deliverable-info">
                        <h4><i class="fas fa-circle-check"></i> Deliverable Ready for Download!</h4>
                        <p>${task.deliverable_notes || 'Your task has been completed and verified. You can access the deliverables below.'}</p>
                    </div>
                    ${task.deliverable_url ? `
                        <a href="${task.deliverable_url}" target="_blank" rel="noopener noreferrer" class="deliverable-btn">
                            <i class="fas fa-download"></i> Download / View Files
                        </a>
                    ` : ''}
                </div>
            `;
        }

        // Files list HTML
        let filesHtml = '<p style="color: var(--text-muted); font-size: 0.84rem;">No attached files for this task.</p>';
        if (Array.isArray(task.files) && task.files.length) {
            filesHtml = `
                <div class="uploaded-files-list">
                    ${task.files.map(f => {
                const info = window.TrackerService.getFileInfo(f.name);
                return `
                            <div class="file-chip">
                                <div class="file-chip-left">
                                    <i class="fas ${info.icon} file-chip-icon" style="color: ${info.color}"></i>
                                    <div class="file-chip-info">
                                        <div class="file-chip-name">${f.name}</div>
                                        <div class="file-chip-meta">${f.size || ''} · ${info.label}</div>
                                    </div>
                                </div>
                                ${f.url && f.url !== '#' ? `
                                    <a href="${f.url}" target="_blank" rel="noopener noreferrer" class="btn ghost-btn btn-sm" style="padding: 0.2rem 0.6rem; font-size: 0.78rem;">
                                        <i class="fas fa-arrow-down"></i>
                                    </a>
                                ` : ''}
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        }

        // Timeline Updates HTML
        let updatesHtml = '<p style="color: var(--text-muted); font-size: 0.84rem;">No update notes logged yet.</p>';
        if (Array.isArray(task.updates) && task.updates.length) {
            updatesHtml = `
                <div class="track-timeline">
                    ${task.updates.map(up => {
                const dateStr = new Date(up.created_at).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                });
                return `
                            <div class="timeline-entry">
                                <div class="timeline-title-row">
                                    <strong>${up.title || 'Status Update'}</strong>
                                    <span class="timeline-time">${dateStr}</span>
                                </div>
                                <p class="timeline-message">${up.message}</p>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        }

        // Status badge label
        const statusMeta = CONFIG.stages.find(s => s.key === task.status) || { label: task.status };

        // WhatsApp inquiry text
        const waInquireText = encodeURIComponent(
            `Hi Imantha! I'm checking on my assessment with tracking code *${task.tracking_code}* (${task.service_title}). Could you provide an update?`
        );

        resultWrapper.innerHTML = `
            <div class="track-result-card">
                <div class="track-card-header">
                    <div class="track-meta-left">
                        <h2>${task.service_title}</h2>
                        <div style="display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap;">
                            <span class="track-code-pill" id="btn-copy-tracking-code" title="Click to copy tracking code">
                                <i class="fas fa-barcode"></i> ${task.tracking_code} <i class="fas fa-copy"></i>
                            </span>
                            <span style="font-size: 0.85rem; color: var(--text-muted);">
                                Client: <strong>${clientDisplayName}</strong>
                            </span>
                        </div>
                    </div>
                    <div class="track-meta-right">
                        <div class="live-sync-indicator">
                            <span class="live-sync-dot"></span> Real-Time Sync Active
                        </div>
                        <div class="status-badge ${task.status}">
                            <i class="fas fa-circle-notch"></i> ${statusMeta.label}
                        </div>
                    </div>
                </div>

                <!-- 5-Stage Stepper -->
                <div class="track-stepper-wrap">
                    <div class="track-stepper">
                        ${stepperHtml}
                    </div>
                </div>

                <!-- Progress percentage bar -->
                <div class="track-progress-meter">
                    <div class="progress-meter-top">
                        <strong>Overall Work Progress</strong>
                        <span class="progress-meter-percent">${progressPercent}%</span>
                    </div>
                    <div class="progress-meter-track">
                        <div class="progress-meter-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>

                <!-- Deliverable Banner if ready -->
                ${deliverableHtml}

                <!-- Details Grid -->
                <div class="track-detail-grid">
                    <div class="track-box">
                        <h4><i class="fas fa-circle-info"></i> Task Overview</h4>
                        <ul class="track-info-list">
                            <li><span>Service</span> <strong>${task.service_title}</strong></li>
                            <li><span>Delivery Speed</span> <strong style="text-transform: capitalize;">${task.urgency || 'Standard'}</strong></li>
                            <li><span>Registered Date</span> <strong>${new Date(task.created_at).toLocaleDateString('en-GB')}</strong></li>
                            ${task.eta_date ? `<li><span>Estimated Target</span> <strong>${new Date(task.eta_date).toLocaleDateString('en-GB')}</strong></li>` : ''}
                            ${task.notes ? `<li style="flex-direction: column; gap: 0.3rem;"><span style="text-align: left;">Brief & Notes</span> <strong style="text-align: left; font-weight: normal; color: #c9d1d9;">${task.notes}</strong></li>` : ''}
                        </ul>
                    </div>

                    <div class="track-box">
                        <h4><i class="fas fa-paperclip"></i> Attached Materials</h4>
                        ${filesHtml}
                    </div>
                </div>

                <!-- Live Milestone Log -->
                <div class="track-box" style="margin-top: 1.5rem;">
                    <h4><i class="fas fa-clock-rotate-left"></i> Live Milestone Log</h4>
                    ${updatesHtml}
                </div>

                <!-- WhatsApp Quick Action -->
                <div class="track-action-bar">
                    <p><i class="fas fa-shield-halved"></i> Have questions or modifications regarding this task?</p>
                    <a href="https://wa.me/${CONFIG.admin.whatsappNumber}?text=${waInquireText}" target="_blank" rel="noopener noreferrer" class="btn wa-btn">
                        <i class="fab fa-whatsapp"></i> Chat on WhatsApp About This Task
                    </a>
                </div>
            </div>
        `;

        // Copy button handler
        const copyBtn = document.getElementById('btn-copy-tracking-code');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(task.tracking_code).then(() => {
                        showToast(`Tracking code ${task.tracking_code} copied!`, 'fa-copy');
                    });
                } else {
                    showToast(`Tracking code: ${task.tracking_code}`, 'fa-barcode');
                }
            });
        }
    }

    /* ------------------------------------------------------------
       3. Admin Work Tracker Modal
    ------------------------------------------------------------ */
    function initAdminTracker() {
        const openBtn = document.getElementById('btn-open-admin-tracker');
        const modal = document.getElementById('admin-tracker-modal');
        const closeBtn = document.getElementById('admin-modal-close');
        const pinInput = document.getElementById('admin-pin-input');
        const pinSubmit = document.getElementById('admin-pin-submit');
        const pinError = document.getElementById('admin-pin-error');
        const pinView = document.getElementById('admin-pin-view');
        const dashView = document.getElementById('admin-dashboard-view');

        // Toggle modal
        if (openBtn && modal) {
            openBtn.addEventListener('click', (e) => {
                e.preventDefault();
                modal.classList.add('active');
                if (!state.isAdminUnlocked) {
                    if (pinInput) setTimeout(() => pinInput.focus(), 200);
                } else {
                    loadAdminDashboard();
                }
            });
        }

        // Check URL hash #admin-tracker
        if (window.location.hash === '#admin-tracker' && modal) {
            modal.classList.add('active');
        }

        // Close modal
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => modal.classList.remove('active'));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        }

        // PIN unlock
        function attemptUnlock() {
            const entered = pinInput ? pinInput.value.trim() : '';
            const correctPin = CONFIG.admin.pin || '2026';

            if (entered === correctPin) {
                state.isAdminUnlocked = true;
                if (pinError) pinError.style.display = 'none';
                if (pinView) pinView.style.display = 'none';
                if (dashView) dashView.style.display = 'block';
                loadAdminDashboard();
            } else {
                if (pinError) {
                    pinError.textContent = 'Incorrect PIN. Default is 2026.';
                    pinError.style.display = 'block';
                }
                if (pinInput) {
                    pinInput.value = '';
                    pinInput.focus();
                }
            }
        }

        if (pinSubmit) pinSubmit.addEventListener('click', attemptUnlock);
        if (pinInput) {
            pinInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') attemptUnlock();
            });
        }

        // Quick Add WhatsApp / Offline Client Task toggle
        const toggleAddBtn = document.getElementById('btn-toggle-quick-add');
        const quickAddForm = document.getElementById('admin-quick-add-form');
        if (toggleAddBtn && quickAddForm) {
            toggleAddBtn.addEventListener('click', () => {
                quickAddForm.classList.toggle('active');
            });
        }

        // Submit Quick Add Form
        const formQuickAdd = document.getElementById('form-quick-add-task');
        if (formQuickAdd) {
            formQuickAdd.addEventListener('submit', async (e) => {
                e.preventDefault();

                const name = document.getElementById('qa-name').value.trim();
                const phone = document.getElementById('qa-phone').value.trim();
                const title = document.getElementById('qa-title').value.trim();
                const budget = document.getElementById('qa-budget').value.trim();
                const notes = document.getElementById('qa-notes').value.trim();
                const status = document.getElementById('qa-status').value || 'submitted';
                const progress = document.getElementById('qa-progress').value || 15;

                if (!name || !title) {
                    showToast('Please enter client name and task title.', 'fa-circle-exclamation');
                    return;
                }

                const created = await window.TrackerService.createTask({
                    client_name: name,
                    client_phone: phone,
                    service_title: title,
                    budget: budget ? Number(budget) : null,
                    notes: notes,
                    status: status,
                    progress_percent: Number(progress),
                    initial_update_message: 'Task registered by Imantha via WhatsApp/Admin portal.'
                });

                formQuickAdd.reset();
                if (quickAddForm) quickAddForm.classList.remove('active');

                loadAdminDashboard();

                // Open WhatsApp prompt with pre-filled message
                const waMessage = window.TrackerService.buildWhatsAppTrackingMessage(created);
                const waTargetPhone = (phone.replace(/[^0-9]/g, '') || CONFIG.admin.whatsappNumber);

                showToast(`Task created! Tracking Code: ${created.tracking_code}`, 'fa-check');

                // Confirmation popup to send WhatsApp message to client
                if (confirm(`Task ${created.tracking_code} registered!\n\nWould you like to open WhatsApp to send the client their tracking link now?`)) {
                    window.open(`https://wa.me/${waTargetPhone}?text=${encodeURIComponent(waMessage)}`, '_blank');
                }
            });
        }
    }

    async function loadAdminDashboard() {
        const container = document.getElementById('admin-tasks-container');
        const statTotal = document.getElementById('stat-total-tasks');
        const statActive = document.getElementById('stat-active-tasks');
        const statCompleted = document.getElementById('stat-completed-tasks');

        if (!container) return;

        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fas fa-circle-notch fa-spin"></i> Loading tasks...</div>';

        const tasks = await window.TrackerService.getAllTasks();

        if (statTotal) statTotal.textContent = tasks.length;
        if (statActive) statActive.textContent = tasks.filter(t => t.status !== 'completed').length;
        if (statCompleted) statCompleted.textContent = tasks.filter(t => t.status === 'completed').length;

        if (!tasks.length) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No tasks recorded yet. Create one above!</p>';
            return;
        }

        container.innerHTML = '';

        tasks.forEach(task => {
            const card = document.createElement('div');
            card.className = 'admin-task-card';

            const formattedDate = new Date(task.created_at).toLocaleDateString('en-GB');
            const cleanPhone = (task.client_phone || '').replace(/[^0-9]/g, '');

            card.innerHTML = `
                <div class="admin-task-head">
                    <div class="admin-task-head-left">
                        <h3>${task.service_title}</h3>
                        <p>
                            Client: <strong>${task.client_name}</strong> · 
                            Code: <strong style="color: var(--secondary); font-family: monospace;">${task.tracking_code}</strong> · 
                            ${formattedDate}
                        </p>
                        ${task.client_phone ? `<p style="font-size: 0.78rem; margin-top: 0.2rem;"><i class="fas fa-phone"></i> ${task.client_phone}</p>` : ''}
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button type="button" class="btn wa-btn btn-sm btn-admin-wa" title="Send WhatsApp tracking message to client">
                            <i class="fab fa-whatsapp"></i> Share Link
                        </button>
                        <button type="button" class="btn ghost-btn btn-sm btn-admin-delete" title="Delete task" style="color: var(--accent);">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>

                <!-- Status & Progress Controls -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0;">
                    <div>
                        <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 0.3rem;">Work Status Stage</label>
                        <select class="q-select admin-select-status" style="padding: 0.5rem;">
                            <option value="submitted" ${task.status === 'submitted' ? 'selected' : ''}>1. Request Received</option>
                            <option value="reviewing" ${task.status === 'reviewing' ? 'selected' : ''}>2. Assessment & Scope</option>
                            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>3. In Progress</option>
                            <option value="quality_polish" ${task.status === 'quality_polish' ? 'selected' : ''}>4. Review & Quality Polish</option>
                            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>5. Ready & Delivered</option>
                        </select>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.3rem;">
                            <span>Progress</span>
                            <span class="admin-progress-val"><strong>${task.progress_percent || 15}%</strong></span>
                        </div>
                        <input type="range" class="admin-range-progress" min="0" max="100" step="5" value="${task.progress_percent || 15}" style="width: 100%; accent-color: var(--primary);">
                    </div>
                </div>

                <!-- Add Note Form & Deliverable Link -->
                <div class="admin-task-actions">
                    <div>
                        <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 0.3rem;">Post Milestone Update Note</label>
                        <div style="display: flex; gap: 0.4rem;">
                            <input type="text" class="q-input admin-note-input" placeholder="e.g. Chapter 1 finished, testing API..." style="padding: 0.5rem; font-size: 0.85rem;">
                            <button type="button" class="btn primary-btn btn-sm btn-post-note">Post</button>
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 0.3rem;">Deliverable Download Link (Cloudinary / Drive)</label>
                        <div style="display: flex; gap: 0.4rem;">
                            <input type="url" class="q-input admin-deliverable-input" value="${task.deliverable_url || ''}" placeholder="https://..." style="padding: 0.5rem; font-size: 0.85rem;">
                            <button type="button" class="btn outline-btn btn-sm btn-save-deliverable">Save</button>
                        </div>
                    </div>
                </div>
            `;

            // Status select listener
            const statusSelect = card.querySelector('.admin-select-status');
            statusSelect.addEventListener('change', async () => {
                await window.TrackerService.updateTask(task.tracking_code, { status: statusSelect.value });
                showToast(`Status changed to ${statusSelect.value}`, 'fa-check');
            });

            // Progress slider listener
            const rangeProgress = card.querySelector('.admin-range-progress');
            const progressVal = card.querySelector('.admin-progress-val strong');
            rangeProgress.addEventListener('input', () => {
                progressVal.textContent = `${rangeProgress.value}%`;
            });
            rangeProgress.addEventListener('change', async () => {
                await window.TrackerService.updateTask(task.tracking_code, { progress_percent: Number(rangeProgress.value) });
                showToast(`Progress set to ${rangeProgress.value}%`, 'fa-check');
            });

            // Post note button listener
            const noteInput = card.querySelector('.admin-note-input');
            const postNoteBtn = card.querySelector('.btn-post-note');
            postNoteBtn.addEventListener('click', async () => {
                const msg = noteInput.value.trim();
                if (!msg) return;
                await window.TrackerService.addTaskUpdate(task.tracking_code, {
                    title: 'Progress Update',
                    message: msg,
                    status_tag: statusSelect.value
                });
                noteInput.value = '';
                showToast('Milestone update posted to live tracker!', 'fa-bolt');
            });

            // Save deliverable link listener
            const deliverableInput = card.querySelector('.admin-deliverable-input');
            const saveDeliverableBtn = card.querySelector('.btn-save-deliverable');
            saveDeliverableBtn.addEventListener('click', async () => {
                const url = deliverableInput.value.trim();
                await window.TrackerService.updateTask(task.tracking_code, { deliverable_url: url });
                showToast('Deliverable link saved!', 'fa-link');
            });

            // WhatsApp button listener
            const waBtn = card.querySelector('.btn-admin-wa');
            waBtn.addEventListener('click', () => {
                const msg = window.TrackerService.buildWhatsAppTrackingMessage(task);
                const target = cleanPhone || CONFIG.admin.whatsappNumber;
                window.open(`https://wa.me/${target}?text=${encodeURIComponent(msg)}`, '_blank');
            });

            // Delete button listener
            const delBtn = card.querySelector('.btn-admin-delete');
            delBtn.addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete task ${task.tracking_code}?`)) {
                    await window.TrackerService.deleteTask(task.tracking_code);
                    showToast(`Task ${task.tracking_code} deleted.`, 'fa-trash');
                    loadAdminDashboard();
                }
            });

            container.appendChild(card);
        });
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        initFileUploadDropzone();
        initVisitorTracker();
        initAdminTracker();
    });

    // Export UI helpers
    window.TrackerUI = {
        getAttachedFiles: () => state.attachedFiles,
        clearAttachedFiles: () => {
            state.attachedFiles = [];
            const container = document.getElementById('uploaded-files-container');
            if (container) container.innerHTML = '';
        },
        performTrackingLookup
    };

})(window, document);

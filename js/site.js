/**
 * Site-wide behaviour that used to be an inline <script> in index.html.
 * Kept in a file so the Content-Security-Policy can forbid inline scripts.
 * The Formspree form id is read from /config.js (built from .env), not hard-coded.
 */
(function () {
    'use strict';

    function initContactForm() {
        const form = document.getElementById('contact-form');
        if (!form) return;

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            const submitBtn = form.querySelector('.submit-btn');
            const originalBtnText = submitBtn.innerHTML;
            const formId = ((window.__TAL_CONFIG__ || {}).formspreeId || '').trim();

            const resetButton = (cls) => {
                setTimeout(() => {
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                    submitBtn.classList.remove(cls);
                }, 3000);
            };

            submitBtn.innerHTML = '<span>Sending...</span> <i class="fas fa-circle-notch fa-spin"></i>';
            submitBtn.disabled = true;

            if (!formId) {
                console.error('Contact form is not configured: set FORMSPREE_FORM_ID in .env and load /config.js');
                submitBtn.innerHTML = '<span>Failed to Send</span> <i class="fas fa-times"></i>';
                submitBtn.classList.add('error');
                resetButton('error');
                return;
            }

            fetch('https://formspree.io/f/' + encodeURIComponent(formId), {
                method: 'POST',
                body: new FormData(form),
                headers: { Accept: 'application/json' }
            })
                .then((response) => {
                    if (!response.ok) throw new Error('Form submission failed');
                    submitBtn.innerHTML = '<span>Message Sent!</span> <i class="fas fa-check"></i>';
                    submitBtn.classList.add('success');
                    form.reset();
                    resetButton('success');
                })
                .catch((error) => {
                    submitBtn.innerHTML = '<span>Failed to Send</span> <i class="fas fa-times"></i>';
                    submitBtn.classList.add('error');
                    resetButton('error');
                    console.error('Form submission error:', error);
                });
        });
    }

    function initBackToTop() {
        const backToTopBtn = document.getElementById('back-to-top');
        if (!backToTopBtn) return;

        window.addEventListener('scroll', () => {
            backToTopBtn.classList.toggle('active', window.pageYOffset > 300);
        });
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function init() {
        initContactForm();
        initBackToTop();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

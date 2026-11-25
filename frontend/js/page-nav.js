/**
 * Navigation behaviour for the secondary pages (services.html). Same classes and behaviour
 * as the main page (see initNavigation in main.js), without loading the 3D scene.
 */
(function () {
    'use strict';

    function init() {
        const nav = document.querySelector('.navigation');
        const toggle = document.querySelector('.nav-toggle');
        const mobileNav = document.querySelector('.mobile-nav');
        if (!nav) return;

        const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 100);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        if (!toggle || !mobileNav) return;
        const close = () => {
            toggle.classList.remove('active');
            mobileNav.classList.remove('active');
            document.body.classList.remove('nav-open');
        };
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            mobileNav.classList.toggle('active');
            document.body.classList.toggle('nav-open');
        });
        document.querySelectorAll('.mobile-nav-link').forEach((a) => a.addEventListener('click', close));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

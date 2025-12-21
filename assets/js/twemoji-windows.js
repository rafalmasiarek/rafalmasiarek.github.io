(function () {
    'use strict';

    // Run ONLY on Windows (fix broken emoji rendering)
    if (!/Windows/i.test(navigator.userAgent)) return;

    if (!window.twemoji || typeof window.twemoji.parse !== 'function') return;

    var root = document.querySelector('.lang-nav'); // scope: only language switcher
    if (!root) return;

    window.twemoji.parse(root, {
        folder: 'svg',
        ext: '.svg'
    });
})();
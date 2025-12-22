// assets/js/analytics-events.js
/*!
 *
 * analytics-events.js
 *
 * Contact Form Frontend Script
 * Copyright (c) 2025 Rafał Masiarek. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorized copying,
 * distribution, modification, or use of this file, in whole or in part,
 * is strictly prohibited without prior written permission of the author.
 *
 * Licensed for internal use only. No license is granted to copy,
 * sublicense, or redistribute this code.
 */
(function () {
    'use strict';

    // ---------- Low-level senders ----------
    function sendUmami(eventName, props) {
        try {
            // Umami "event" API: window.umami(name, data)
            if (typeof window.umami === 'function') {
                window.umami(eventName, props || {});
                return true;
            }

            // Some Umami builds expose an object API
            if (window.umami && typeof window.umami.track === 'function') {
                window.umami.track(eventName, props || {});
                return true;
            }
        } catch (_) { /* noop */ }
        return false;
    }

    function sendGtag(eventName, props) {
        try {
            if (typeof window.gtag === 'function') {
                window.gtag('event', eventName, props || {});
                return true;
            }
        } catch (_) { /* noop */ }
        return false;
    }

    // Public universal event API
    window.track = function (eventName, props) {
        sendUmami(eventName, props);
        sendGtag(eventName, props);
    };

    // ---------- Page view tracking (SPA + normal pages) ----------
    function currentPageInfo() {
        // Works for:
        // - normal pages: pathname
        // - vinyl router: /vinyls/ + #/slug
        var path = String(location.pathname || '/');
        var hash = String(location.hash || '');

        // Canonical-ish URL pieces
        var page_path = path + hash;
        var page_location = String(location.href || '');

        // Vinyl detail detection
        var vinyl_slug = null;
        if (hash && /^#\/.+/.test(hash)) {
            vinyl_slug = decodeURIComponent(hash.replace(/^#\//, '')).trim() || null;
        }

        var page_type = 'page';
        if (path.indexOf('/vinyls') !== -1) {
            page_type = vinyl_slug ? 'vinyl_detail' : 'vinyl_list';
        }

        return {
            page_type: page_type,
            page_path: page_path,
            page_location: page_location,
            vinyl_slug: vinyl_slug
        };
    }

    var __lastPageKey = null;

    function trackPageView(reason) {
        var info = currentPageInfo();
        var key = info.page_path;

        // Prevent duplicates (especially on load + hashchange)
        if (__lastPageKey === key) return;
        __lastPageKey = key;

        // Umami: if auto_track is on, it already tracks initial load,
        // but it won't track SPA hash navigation. We send our own "page_view".
        sendUmami('page_view', {
            page_type: info.page_type,
            page_path: info.page_path,
            vinyl_slug: info.vinyl_slug,
            reason: reason || 'nav'
        });

        // GA4: manual page_view for SPA navigation
        sendGtag('page_view', {
            page_location: info.page_location,
            page_path: info.page_path,
            page_title: document.title || '',
            page_type: info.page_type,
            vinyl_slug: info.vinyl_slug,
            reason: reason || 'nav'
        });

        // Extra: if it's vinyl detail, emit a dedicated event too
        if (info.page_type === 'vinyl_detail' && info.vinyl_slug) {
            window.track('vinyl_open', {
                slug: info.vinyl_slug
            });
        }
    }

    // Expose for routers if you ever want explicit calls
    window.trackPageView = trackPageView;

    // ---------- Click tracking ----------
    function closestAnchor(el) {
        if (!el || !(el instanceof Element)) return null;
        return el.closest('a');
    }

    function isExternalLink(a) {
        try {
            var u = new URL(a.href, location.origin);
            return u.origin !== location.origin;
        } catch (_) {
            return false;
        }
    }

    function isVisible(el) {
        if (!el) return false;
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function normalizePath(href) {
        try {
            var u = new URL(href, location.origin);
            return (u.pathname || '/') + (u.hash || '');
        } catch (_) {
            return String(href || '');
        }
    }

    // Event delegation
    document.addEventListener('click', function (e) {
        var a = closestAnchor(e.target);
        if (!a) return;

        // Vinyl card click: <a class="card-link" href="#/slug">
        if (a.classList.contains('card-link')) {
            var href = a.getAttribute('href') || '';
            var m = href.match(/^#\/(.+)$/);
            var slug = m ? decodeURIComponent(m[1]) : null;

            window.track('vinyl_card_click', {
                slug: slug || '',
                href: href
            });
            return;
        }

        // Listen links (detail)
        if (a.id === 'd-spotify') {
            window.track('vinyl_listen_spotify', {
                slug: (currentPageInfo().vinyl_slug || '')
            });
            return;
        }
        if (a.id === 'd-apple') {
            window.track('vinyl_listen_apple', {
                slug: (currentPageInfo().vinyl_slug || '')
            });
            return;
        }

        // Back to list (detail)
        if (a.id === 'back-to-list') {
            window.track('vinyl_back_to_list', {
                from_slug: (currentPageInfo().vinyl_slug || '')
            });
            return;
        }

        // --- Projects tracking (supports current projects.js markup) ---
        // <a href="..." target="_blank" class="btn ...">View on Github</a>
        var card = a.closest && a.closest('.project-card');
        if (card) {
            var titleEl = card.querySelector('.card-title');
            var name = '';
            if (titleEl) {
                // take only the first text node (repo name), ignore badge text
                name = String(titleEl.childNodes && titleEl.childNodes[0] ? titleEl.childNodes[0].textContent : titleEl.textContent || '');
                name = name.trim().replace(/\s+/g, ' ').slice(0, 120);
            }
            var hrefP = a.getAttribute('href') || '';

            window.track('project_click', {
                project: name,
                href: hrefP,
                external: true
            });
            return;
        }

        // --- Footer/nav & socials tracking ---
        // site-footer.html: <footer> <nav class="navigation"> <a href=... target=_blank ...>
        var footerNav = a.closest && a.closest('footer nav.navigation');
        if (footerNav) {
            var hrefF = a.getAttribute('href') || '';
            var textF = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
            var isExtF = isExternalLink(a) || a.target === '_blank';

            window.track(isExtF ? 'social_click' : 'footer_nav_click', {
                text: textF,
                href: hrefF,
                path: normalizePath(hrefF)
            });
            return;
        }

        // Generic navigation clicks
        var hrefAbs = a.getAttribute('href') || '';
        if (!hrefAbs || hrefAbs === '#' || hrefAbs.startsWith('javascript:')) return;

        var external = isExternalLink(a);
        window.track(external ? 'outbound_click' : 'nav_click', {
            text: (a.textContent || '').trim().slice(0, 120),
            href: hrefAbs,
            path: normalizePath(hrefAbs)
        });
    }, true);

    // Artist filter tracking (buttons)
    document.addEventListener('click', function (e) {
        if (!(e.target instanceof Element)) return;

        var btn = e.target.closest('[data-artist]');
        if (!btn) return;

        var artist = btn.getAttribute('data-artist') || '';
        window.track('vinyl_filter_artist', { artist: artist });
    }, true);

    // ---------- SPA hooks ----------
    window.addEventListener('hashchange', function () {
        trackPageView('hashchange');
    });

    window.addEventListener('popstate', function () {
        trackPageView('popstate');
    });

    document.addEventListener('DOMContentLoaded', function () {
        trackPageView('load');
    });

    // ---------- Contact form tracking ----------
    (function () {
        var form = document.getElementById('contact-form');
        if (!form) return;

        var alertBox = document.getElementById('contact-form-alert');

        var started = false;
        var submitted = false;
        var dirtyFields = {
            name: false,
            email: false,
            subject: false,
            message: false
        };

        function markStarted() {
            if (started) return;
            started = true;

            window.track('contact_form_start', {
                page_path: (location.pathname || '/') + (location.hash || '')
            });
        }

        function summarizeDirty() {
            var keys = Object.keys(dirtyFields);
            var filled = keys.filter(function (k) { return dirtyFields[k]; });
            return {
                filled_count: filled.length,
                filled_fields: filled.join(',')
            };
        }

        function fieldIdToKey(id) {
            switch (id) {
                case 'contact-form-nameInput': return 'name';
                case 'contact-form-replyToInput': return 'email';
                case 'contact-form-subjectInput': return 'subject';
                case 'contact-form-messageInput': return 'message';
                default: return null;
            }
        }

        // Track typing / input
        form.addEventListener('input', function (e) {
            if (!(e.target instanceof Element)) return;

            var key = fieldIdToKey(e.target.id);
            if (!key) return;

            var val = String(e.target.value || '').trim();
            if (val.length === 0) return;

            dirtyFields[key] = true;
            markStarted();
        }, true);

        // Submit attempt + basic recaptcha checks
        form.addEventListener('submit', function () {
            submitted = true;

            // In production you have #contact-form-recaptcha-token
            var recaptchaEl = document.getElementById('contact-form-recaptcha-token');
            if (recaptchaEl) {
                var token = String(recaptchaEl.value || '').trim();
                var s1 = summarizeDirty();

                // If token is empty at submit time, it's almost always recaptcha failure/not ready.
                if (!token) {
                    window.track('contact_form_recaptcha_missing', {
                        page_path: (location.pathname || '/') + (location.hash || ''),
                        filled_count: s1.filled_count,
                        filled_fields: s1.filled_fields
                    });
                } else {
                    window.track('contact_form_submit', {
                        page_path: (location.pathname || '/') + (location.hash || ''),
                        filled_count: s1.filled_count,
                        filled_fields: s1.filled_fields
                    });
                }
            } else {
                // Dev mode (no recaptcha field)
                var s2 = summarizeDirty();
                window.track('contact_form_submit', {
                    page_path: (location.pathname || '/') + (location.hash || ''),
                    filled_count: s2.filled_count,
                    filled_fields: s2.filled_fields,
                    mode: 'no_recaptcha'
                });
            }
        }, true);

        // Detect API error by observing alert visibility/style changes
        if (alertBox && typeof MutationObserver !== 'undefined') {
            var lastVisible = isVisible(alertBox) && alertBox.style.display !== 'none';

            var obs = new MutationObserver(function () {
                var visibleNow = isVisible(alertBox) && alertBox.style.display !== 'none';
                if (!visibleNow || visibleNow === lastVisible) return;

                lastVisible = visibleNow;

                // Try to include short error text (keep it short; avoid PII)
                var msg = (alertBox.textContent || '').trim().slice(0, 180);

                window.track('contact_form_error', {
                    page_path: (location.pathname || '/') + (location.hash || ''),
                    message: msg
                });
            });

            obs.observe(alertBox, {
                attributes: true,
                attributeFilter: ['style', 'class'],
                childList: true,
                subtree: true
            });
        }

        // Abandonment: user started, did not submit, leaves page / tab
        function maybeAbandon(reason) {
            if (!started) return;
            if (submitted) return;

            var s3 = summarizeDirty();

            window.track('contact_form_abandon', {
                page_path: (location.pathname || '/') + (location.hash || ''),
                reason: reason || 'leave',
                filled_count: s3.filled_count,
                filled_fields: s3.filled_fields
            });
        }

        // Fires when navigating away / closing
        window.addEventListener('beforeunload', function () {
            maybeAbandon('beforeunload');
        });

        // Fires when tab goes background (often stronger signal than unload)
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') {
                maybeAbandon('visibilitychange');
            }
        });
    })();

    // ---------- Licenses table tracking ----------
    (function () {
        function textOf(el) {
            return (el && el.textContent ? String(el.textContent) : '').replace(/\s+/g, ' ').trim();
        }

        function pagePath() {
            return String(location.pathname || '/') + String(location.hash || '');
        }

        document.addEventListener('click', function (e) {
            if (!(e.target instanceof Element)) return;

            var a = e.target.closest('a');
            if (!a) return;

            var table = a.closest('table.licenses-table');
            if (!table) return;

            var row = a.closest('tr');
            if (!row) return;

            var tds = row.querySelectorAll('td');
            var name = tds[0] ? textOf(tds[0]).replace('↗', '').trim() : '';
            var version = tds[1] ? textOf(tds[1]) : '';
            var license = tds[2] ? textOf(tds[2]) : '';
            var source = tds[3] ? textOf(tds[3]) : '';

            window.track('license_pkg_click', {
                page_path: pagePath(),
                name: name,
                version: version,
                license: license,
                source: source,
                href: a.getAttribute('href') || ''
            });
        }, true);
    })();
})();
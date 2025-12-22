// assets/js/access-helper.js
/*!
 *
 * contactform_v2.js
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
    const BASE_URL = 'https://access.masiarek.pl/v1';
    const EVENTS_BASE = 'https://events.masiarek.pl';

    const STREAM_SCOPES = ['stream:ssh-access'];

    const modeInputs = document.querySelectorAll('input[name="ssh-gen-mode"]');
    const usernameInput = document.getElementById('ssh-gen-username');
    const sudoCheckbox = document.getElementById('ssh-gen-sudo');
    const output = document.getElementById('ssh-gen-output');
    const copyBtn = document.getElementById('ssh-gen-copy');
    const summary = document.getElementById('ssh-gen-summary');
    const sessionInput = document.getElementById('ssh-gen-session');

    const alertBox = document.getElementById('ssh-gen-alert');
    const alertText = document.getElementById('ssh-gen-alert-text');
    const alertClose = document.getElementById('ssh-gen-alert-close');

    const banner = document.getElementById('ssh-gen-banner');
    const bannerClose = document.getElementById('ssh-gen-banner-close');

    if (!output) return;

    let userActivated = false;
    let eventSource = null;
    let currentToken = null;

    const MODE_ADD = 'add';
    const MODE_REMOVE = 'remove';
    const MODE_UPDATE = 'update'; // "Update key only / manually"

    // ---------------------------------------------
    // CSRF
    // ---------------------------------------------
    const CSRF_ENDPOINT = 'https://masiarek.pl/api/v1/csrf/generate';
    const CSRF_CONTAINER = 'ssh-install-stream-event';

    let csrfToken = null;
    let csrfTokenTime = null; // do prostego sprawdzenia TTL

    async function ensureCsrfToken() {
        const now = Date.now();

        // Jeśli token mamy i nie "stary", użyj ponownie
        if (csrfToken && csrfTokenTime && (now - csrfTokenTime) < 850 * 1000) {
            return csrfToken;
        }

        try {
            const params = new URLSearchParams({ container: CSRF_CONTAINER });
            const resp = await fetch(CSRF_ENDPOINT + '?' + params.toString(), {
                method: 'GET',
                credentials: 'include'
            });

            if (!resp.ok) {
                console.warn('CSRF fetch failed with status', resp.status);
                return null;
            }

            const data = await resp.json();
            if (data && data.status === 'success' && data.data && data.data.csrf_token) {
                csrfToken = data.data.csrf_token;
                csrfTokenTime = now;
                return csrfToken;
            }

            console.warn('Unexpected CSRF response structure', data);
            return null;
        } catch (e) {
            console.warn('Error fetching CSRF token', e);
            return null;
        }
    }

    // -------------------------------------------------
    // Session ID
    // -------------------------------------------------
    function generateSessionId() {
        return 'sess-' +
            Date.now().toString(36) + '-' +
            Math.random().toString(36).slice(2, 10);
    }

    let sessionId = generateSessionId();
    if (sessionInput) sessionInput.value = sessionId;

    // -------------------------------------------------
    // Alerts
    // -------------------------------------------------
    function showAlert(type, text) {
        if (!alertBox) return;

        alertBox.classList.add('alert');
        alertBox.classList.remove(
            'alert-blue', 'alert-green', 'alert-red',
            'alert-orange', 'alert-bgray'
        );

        if (type === 'success') {
            alertBox.classList.add('alert-green');
        } else if (type === 'error') {
            alertBox.classList.add('alert-red');
        } else {
            alertBox.classList.add('alert-blue');
        }

        alertText.textContent = text;
        alertBox.style.display = 'block';
    }

    function hideAlert() {
        if (alertBox) alertBox.style.display = 'none';
    }

    if (alertClose) {
        alertClose.addEventListener('click', function () {
            hideAlert();
            closeStream();
            revokeToken();
        });
    }

    // -------------------------------------------------
    // Tryb UI – disable/enable user + sudo
    // -------------------------------------------------
    function updateModeUI(mode) {
        const isUpdateMode = (mode === MODE_UPDATE);

        if (usernameInput) {
            usernameInput.disabled = isUpdateMode;
            usernameInput.classList.toggle('input--disabled', isUpdateMode);
        }

        if (sudoCheckbox) {
            sudoCheckbox.disabled = isUpdateMode;
            if (isUpdateMode) {
                sudoCheckbox.checked = false;
            }
            const sudoLabel = sudoCheckbox.closest('label');
            if (sudoLabel) {
                sudoLabel.classList.toggle('input--disabled', isUpdateMode);
            }
        }
    }

    function getCurrentMode() {
        const modeEl = document.querySelector('input[name="ssh-gen-mode"]:checked');
        return modeEl ? modeEl.value : MODE_ADD;
    }

    // -------------------------------------------------
    // Build SSH Command
    // -------------------------------------------------
    function buildCommand() {
        const mode = getCurrentMode();

        const username = (usernameInput?.value || 'rm').trim() || 'rm';
        const sudoFlag = !!sudoCheckbox && sudoCheckbox.checked;

        let cmd = 'curl -Ls "' + BASE_URL + '" | ';

        if (mode === MODE_ADD || mode === MODE_REMOVE) {
            cmd += 'sudo bash -s -- ';
        } else {
            cmd += 'bash -s -- ';
        }

        cmd += mode + ' ';

        if (mode !== MODE_UPDATE) {
            if (username) cmd += '--username ' + username + ' ';
            if (mode === MODE_ADD && sudoFlag) cmd += '--sudo ';
            if (sessionId) cmd += '--session-id ' + sessionId + ' ';
        }

        output.value = cmd.trim();

        let text;
        if (mode === MODE_ADD) {
            text = 'Action: set up access for user "' + username + '"' +
                (sudoFlag ? ' with passwordless sudo.' : '.');
        } else if (mode === MODE_REMOVE) {
            text = 'Action: remove access (user "' + username + '", schedules, sudoers). Uses sudo.';
        } else {
            text = 'Action: update SSH key for current user only (no username / sudo / session-id / stream).';
        }

        summary.innerHTML = text;

        updateModeUI(mode);
    }

    modeInputs.forEach(i => i.addEventListener('change', buildCommand));
    usernameInput?.addEventListener('input', buildCommand);
    sudoCheckbox?.addEventListener('change', buildCommand);

    // -------------------------------------------------
    // Clipboard + start stream
    // -------------------------------------------------
    if (copyBtn) {
        copyBtn.addEventListener('click', function () {
            const text = output.value.trim();
            if (!text) return;

            userActivated = true;

            const mode = getCurrentMode();

            if (mode !== MODE_UPDATE) {
                showAlert(
                    'info',
                    'Waiting for server confirmation… Once the script completes on the target server, this page will show its hostname and IP.'
                );
            }

            const success = () => {
                const original = copyBtn.textContent;
                copyBtn.textContent = '✔ Copied';
                setTimeout(() => copyBtn.textContent = '📋 Copy', 900);
            };

            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(text).then(success).catch(() => {
                    fallbackCopy(text, success);
                });
            } else {
                fallbackCopy(text, success);
            }

            if (mode !== MODE_UPDATE) {
                registerForStream();
            }
        });
    }

    function fallbackCopy(text, callback) {
        output.focus();
        output.select();
        try {
            document.execCommand('copy');
        } catch (_) { }
        if (callback) callback();
    }

    // -------------------------------------------------
    // Events API + CSRF
    // -------------------------------------------------
    async function registerForStream() {
        if (!window.fetch || !window.EventSource) return;
        if (eventSource) return; // already open

        try {
            const csrf = await ensureCsrfToken();
            if (!csrf) {
                console.warn('No CSRF token – aborting registerForStream');
                if (userActivated) {
                    showAlert('error', 'Could not initialize real-time updates (CSRF).');
                }
                return;
            }

            const email = sessionId + '@access.masiarek.pl';

            const payload = {
                email: email,
                scopes: STREAM_SCOPES,
                _ttl: 3600
            };

            const headers = {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf,
                'X-CSRF-Container': CSRF_CONTAINER
            };

            const resp = await fetch(EVENTS_BASE + '/register', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!resp.ok) {
                if (userActivated) {
                    showAlert(
                        'error',
                        'Could not initialize real-time updates.'
                    );
                }
                return;
            }

            const data = await resp.json();
            if (!data.token) return;

            currentToken = data.token;
            openStream(data.token);
        } catch (err) {
            console.warn('registerForStream error', err);
            if (userActivated) {
                showAlert(
                    'error',
                    'Events service error.'
                );
            }
        }
    }

    async function revokeToken() {
        if (!currentToken) return;
        try {
            const csrf = await ensureCsrfToken();
            if (!csrf) {
                console.warn('No CSRF token – revokeToken without CSRF');
            }

            const headers = {
                'Authorization': 'Bearer ' + currentToken,
                'Content-Type': 'application/json'
            };

            if (csrf) {
                headers['X-CSRF-Token'] = csrf;
                headers['X-CSRF-Container'] = CSRF_CONTAINER;
            }

            await fetch(EVENTS_BASE + '/deregister', {
                method: 'POST',
                headers: headers,
                body: '{}',
                credentials: 'include'
            });
        } catch (err) {
            console.warn('Failed to revoke token:', err);
        } finally {
            currentToken = null;
        }
    }

    function closeStream() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    }

    function openStream(token) {
        const params = new URLSearchParams({
            session: sessionId,
            token: token
        });

        const es = new EventSource(
            EVENTS_BASE + '/stream/ssh-access?' + params.toString()
        );
        eventSource = es;

        es.onmessage = function (e) {
            handleEventData(e.data);
        };

        es.addEventListener('access-installed', function (e) {
            handleEventData(e.data, 'access-installed');
        });

        es.addEventListener('access-removed', function (e) {
            handleEventData(e.data, 'access-removed');
        });

        es.onerror = function () {
            console.warn('EventSource error');
        };
    }

    function handleEventData(raw, forcedType) {
        let data;
        try {
            data = JSON.parse(raw);
        } catch (_) {
            return;
        }

        if (!userActivated) return;

        const type = forcedType || data.type || 'log';

        if (type === 'access-installed') {
            const host = data.host || 'unknown host';
            const ip = data.ip_public || data.ip_internal || 'unknown IP';

            showAlert(
                'success',
                'SSH access has been installed on "' + host + '" (IP: ' + ip + ').'
            );

            revokeToken();
            closeStream();
        }

        if (type === 'access-removed') {
            const host = data.host || 'unknown host';
            showAlert(
                'info',
                'SSH access has been removed from "' + host + '".'
            );

            revokeToken();
            closeStream();
        }
    }

    // -------------------------------------------------
    // Banner
    // -------------------------------------------------
    if (bannerClose) {
        bannerClose.addEventListener('click', function () {
            if (banner) {
                banner.style.display = 'none';
            }
            closeStream();
            revokeToken();
        });
    }

    // -------------------------------------------------
    // Init
    // -------------------------------------------------
    buildCommand();
})();


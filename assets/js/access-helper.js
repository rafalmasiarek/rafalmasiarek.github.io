// assets/js/access-helper.js
/*!
 * Access Helper Script
 * Simple client-side script to generate SSH access commands and listen for installation events.
 * 
 * Copyright (c) 2025 RafaĹ Masiarek. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorized copying,
 * distribution, modification, or use of this file, in whole or in part,
 * is strictly prohibited without prior written permission of the author.
 *
 * Licensed for internal use only. No license is granted to copy,
 * sublicense, or redistribute this code.
 */
(function () {
    const BASE_URL = 'https://access.masiarek.pl';

    // New API base (OpenAPI: /api as server, but here we use absolute URL).
    const API_BASE = 'https://masiarek.pl/api/v1';

    // Scope + channel naming:
    // - scope: stream:ssh-access
    // - SSE endpoint expects channel query param, e.g. channel=ssh-access
    const STREAM_SCOPES = ['stream:ssh-access'];
    const STREAM_CHANNEL = 'ssh-access';

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

    // SSE via fetch streaming (AbortController)
    let streamAbort = null;

    // Bearer token for events endpoints
    let currentToken = null;

    const MODE_ADD = 'add';
    const MODE_REMOVE = 'remove';
    const MODE_UPDATE = 'update'; // "Update key only / manually"

    // ---------------------------------------------
    // CSRF
    // ---------------------------------------------
    const CSRF_ENDPOINT = API_BASE + '/csrf/generate';
    const CSRF_CONTAINER = 'ssh-install-stream-event';

    let csrfToken = null;
    let csrfTokenTime = null; // naive TTL cache

    async function ensureCsrfToken() {
        const now = Date.now();

        // Reuse token if not too old (server TTL 900s; keep a safe margin).
        if (csrfToken && csrfTokenTime && (now - csrfTokenTime) < 850 * 1000) {
            return csrfToken;
        }

        try {
            const params = new URLSearchParams({ container: CSRF_CONTAINER });
            const resp = await fetch(CSRF_ENDPOINT + '?' + params.toString(), {
                method: 'GET',
                credentials: 'include',
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
    // Mode UI – disable/enable user + sudo
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
    // Events API (new endpoints) + CSRF headers
    // -------------------------------------------------
    async function registerForStream() {
        if (!window.fetch) return;
        if (streamAbort) return; // already streaming

        try {
            const csrf = await ensureCsrfToken();
            if (!csrf) {
                console.warn('No CSRF token – aborting registerForStream');
                if (userActivated) showAlert('error', 'Could not initialize real-time updates (CSRF).');
                return;
            }

            // Group tokens by (ip,email); use sessionId as a stable per-page identifier.
            const email = sessionId + '@access.masiarek.pl';

            const payload = {
                email: email,
                scopes: STREAM_SCOPES,
                ttl_sec: 3600,
            };

            const headers = {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf,
                'X-CSRF-Container': CSRF_CONTAINER,
            };

            const resp = await fetch(API_BASE + '/events/token', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                credentials: 'include',
            });

            if (!resp.ok) {
                if (userActivated) showAlert('error', 'Could not initialize real-time updates.');
                return;
            }

            const data = await resp.json();
            const token = data?.data?.token;
            if (!token) {
                console.warn('Unexpected token response', data);
                if (userActivated) showAlert('error', 'Could not initialize real-time updates (token).');
                return;
            }

            currentToken = token;
            openStream(token);
        } catch (err) {
            console.warn('registerForStream error', err);
            if (userActivated) showAlert('error', 'Events service error.');
        }
    }

    async function revokeToken() {
        if (!currentToken) return;

        try {
            const csrf = await ensureCsrfToken();

            const headers = {
                'Authorization': 'Bearer ' + currentToken,
                'Content-Type': 'application/json',
            };

            if (csrf) {
                headers['X-CSRF-Token'] = csrf;
                headers['X-CSRF-Container'] = CSRF_CONTAINER;
            }

            await fetch(API_BASE + '/events/revoke', {
                method: 'POST',
                headers,
                body: '{}',
                credentials: 'include',
            });
        } catch (err) {
            console.warn('Failed to revoke token:', err);
        } finally {
            currentToken = null;
        }
    }

    function closeStream() {
        if (streamAbort) {
            try { streamAbort.abort(); } catch (_) { }
            streamAbort = null;
        }
    }

    // -------------------------------------------------
    // SSE stream via fetch (so we can send Authorization + CSRF headers)
    // -------------------------------------------------
    async function openStream(token) {
        closeStream();

        const csrf = await ensureCsrfToken();
        if (!csrf) {
            console.warn('No CSRF token – aborting openStream');
            if (userActivated) showAlert('error', 'Could not initialize real-time updates (CSRF).');
            return;
        }

        streamAbort = new AbortController();

        const params = new URLSearchParams({
            channel: STREAM_CHANNEL,
        });

        const headers = {
            'Accept': 'text/event-stream',
            'Authorization': 'Bearer ' + token,
            'X-CSRF-Token': csrf,
            'X-CSRF-Container': CSRF_CONTAINER,
        };

        try {
            const resp = await fetch(API_BASE + '/events/stream?' + params.toString(), {
                method: 'GET',
                headers,
                credentials: 'include',
                signal: streamAbort.signal,
            });

            if (!resp.ok || !resp.body) {
                console.warn('Stream HTTP error', resp.status);
                return;
            }

            await readSseStream(resp.body, (evtName, evtData) => {
                if (!userActivated) return;

                // evtData is string (raw "data:" payload) – expected JSON
                handleEventData(evtData, evtName);
            }, streamAbort.signal);
        } catch (e) {
            if (streamAbort?.signal?.aborted) return; // closed intentionally
            console.warn('Stream error', e);
        }
    }

    async function readSseStream(readableStream, onEvent, signal) {
        const reader = readableStream.getReader();
        const decoder = new TextDecoder('utf-8');

        let buffer = '';

        while (true) {
            if (signal?.aborted) break;

            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // SSE frames are separated by a blank line
            let idx;
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
                const rawFrame = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 2);

                const parsed = parseSseFrame(rawFrame);
                if (!parsed) continue;

                const { event, data } = parsed;
                if (data !== null) onEvent(event, data);
            }
        }

        try { reader.releaseLock(); } catch (_) { }
    }

    function parseSseFrame(frame) {
        // Minimal SSE parser: supports `event:` and one or many `data:` lines.
        // Ignores comments and other fields.
        const lines = frame.split('\n');

        let eventName = null;
        const dataLines = [];

        for (const line of lines) {
            if (!line) continue;
            if (line.startsWith(':')) continue;

            if (line.startsWith('event:')) {
                eventName = line.slice('event:'.length).trim() || null;
            } else if (line.startsWith('data:')) {
                dataLines.push(line.slice('data:'.length).trimEnd());
            }
        }

        const data = dataLines.length ? dataLines.join('\n') : null;
        return { event: eventName, data };
    }

    function handleEventData(raw, forcedType) {
        let data;
        try {
            data = JSON.parse(raw);
        } catch (_) {
            return;
        }

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
            return;
        }

        if (type === 'access-removed') {
            const host = data.host || 'unknown host';

            showAlert(
                'info',
                'SSH access has been removed from "' + host + '".'
            );

            revokeToken();
            closeStream();
            return;
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
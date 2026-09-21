// assets/js/access-helper.js
/*!
 * Access Helper Script
 * Simple client-side script to generate SSH access commands and listen for installation events.
 *
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
    const BASE_URL = 'https://access.masiarek.pl';
    const STATUS_BASE = BASE_URL + '/status';

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

    const MODE_ADD = 'add';
    const MODE_REMOVE = 'remove';
    const MODE_UPDATE = 'update'; // "Update key only / manually"

    // -------------------------------------------------
    // Session ID
    //
    // This is the only credential in the whole flow: access.masiarek.pl's
    // /status/{id} endpoint treats knowing this value as proof you're allowed
    // to read and write that one slot. Math.random() is not a CSPRNG and is
    // partially predictable (seeded off Date.now()) — crypto.getRandomValues()
    // gives 256 bits of real entropy, which is what makes that trust model
    // sound.
    // -------------------------------------------------
    function generateSessionId() {
        const bytes = new Uint8Array(32);
        (window.crypto || window.msCrypto).getRandomValues(bytes);
        let binary = '';
        bytes.forEach(function (b) { binary += String.fromCharCode(b); });
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
                openStatusStream();
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
    // Status stream (SSE via native EventSource)
    //
    // access.masiarek.pl/status/{id} holds the connection open for ~25s and
    // closes; EventSource reconnects automatically on its own by design, so
    // this only needs to be opened once per Copy click and closed explicitly
    // once a terminal event arrives (or the user dismisses the alert/banner).
    // -------------------------------------------------
    function closeStream() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    }

    function handleTerminalEvent(kind) {
        return function (evt) {
            let data;
            try {
                data = JSON.parse(evt.data);
            } catch (_) {
                return;
            }

            const host = data.host || 'unknown host';
            const ip = data.ip_public || data.ip_internal || 'unknown IP';

            if (kind === 'installed') {
                showAlert('success', 'SSH access has been installed on "' + host + '" (IP: ' + ip + ').');
            } else if (kind === 'removed') {
                showAlert('info', 'SSH access has been removed from "' + host + '".');
            } else if (kind === 'error') {
                showAlert('error', 'Something went wrong while setting up access on "' + host + '". Check the target server’s output.');
            }

            closeStream();
        };
    }

    function openStatusStream() {
        if (!window.EventSource) return;

        closeStream();
        eventSource = new EventSource(STATUS_BASE + '/' + encodeURIComponent(sessionId));

        eventSource.addEventListener('installed', handleTerminalEvent('installed'));
        eventSource.addEventListener('removed', handleTerminalEvent('removed'));
        // The server sends "status-error" rather than "error" — EventSource
        // reserves the bare "error" event name for connection failures, and
        // a real status of "error" would otherwise be indistinguishable from
        // the connection just hiccuping.
        eventSource.addEventListener('status-error', handleTerminalEvent('error'));

        eventSource.onerror = function () {
            // Transport-level hiccup or the server's periodic 25s close —
            // EventSource retries on its own, nothing to do here.
        };
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
        });
    }

    // -------------------------------------------------
    // Init
    // -------------------------------------------------
    buildCommand();
})();

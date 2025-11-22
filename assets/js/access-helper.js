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

    if (!output) return;

    let userActivated = false;
    let eventSource = null;
    let currentToken = null;

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
        alertClose.addEventListener('click', hideAlert);
    }

    // -------------------------------------------------
    // Build SSH command
    // -------------------------------------------------
    function buildCommand() {
        const modeEl = document.querySelector('input[name="ssh-gen-mode"]:checked');
        const mode = modeEl ? modeEl.value : 'add';
        const username = (usernameInput?.value || 'rm').trim() || 'rm';
        const sudoFlag = !!sudoCheckbox && sudoCheckbox.checked;

        let cmd = 'curl -Ls "' + BASE_URL + '" | ';

        if (mode === 'add' || mode === 'remove') {
            cmd += 'sudo bash -s -- ';
        } else {
            cmd += 'bash -s -- ';
        }

        cmd += mode + ' ';

        if (username) cmd += '--username ' + username + ' ';
        if (mode === 'add' && sudoFlag) cmd += '--sudo ';
        if (sessionId) cmd += '--session-id ' + sessionId + ' ';

        output.value = cmd.trim();

        let text;
        if (mode === 'add') {
            text = 'Action: set up access for user "' + username + '"' +
                (sudoFlag ? ' with passwordless sudo.' : '.');
        } else if (mode === 'remove') {
            text = 'Action: remove access (user "' + username + '", schedules, sudoers). Uses sudo.';
        } else {
            text = 'Action: run key update for current user (ignores sudo flag).';
        }

        summary.innerHTML = text;
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

            showAlert(
                'info',
                'Waiting for server confirmation… Once the script completes on the target server, this page will show its hostname and IP.'
            );

            const success = () => {
                const original = copyBtn.textContent;
                copyBtn.textContent = '✔ Copied';
                setTimeout(() => copyBtn.textContent = '⧉ Copy', 900);
            };

            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(text).then(success).catch(() => {
                    fallbackCopy(text, success);
                });
            } else {
                fallbackCopy(text, success);
            }

            // Start events stream only after user clicks Copy
            registerForStream();
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
    // Events API
    // -------------------------------------------------
    async function registerForStream() {
        if (!window.fetch || !window.EventSource) return;
        if (eventSource) return; // already open

        try {
            const email = sessionId + '@access.masiarek.pl';

            const payload = {
                email: email,
                scopes: STREAM_SCOPES,
                _ttl: 3600
            };

            const resp = await fetch(EVENTS_BASE + '/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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
            await fetch(EVENTS_BASE + '/deregister', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + currentToken,
                    'Content-Type': 'application/json'
                },
                body: '{}'
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
            // do not auto-close here; we want it to retry until we get a real event
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

            // We got what we needed – revoke token and close the stream
            revokeToken();
            closeStream();
        }

        if (type === 'access-removed') {
            const host = data.host || 'unknown host';
            showAlert(
                'info',
                'SSH access has been removed from "' + host + '".'
            );

            // After removal, also revoke token and close stream
            revokeToken();
            closeStream();
        }
    }

    // -------------------------------------------------
    // Init
    // -------------------------------------------------
    buildCommand();
})();
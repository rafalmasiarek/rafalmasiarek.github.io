(function () {
    const BASE_URL = 'https://access.masiarek.pl/v1';
    const EVENTS_BASE = 'https://events.masiarek.pl';

    // Email used for token registration – purely informational
    const EVENTS_EMAIL = 'ssh-helper@masiarek.pl';

    // Allowed scopes for streaming events for this component
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

    // Indicates whether the user actually clicked "Copy"
    let userActivated = false;

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
    // Alerts (uses your .alert classes)
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

        let cmd = `curl -Ls "${BASE_URL}" | `;

        if (mode === 'add' || mode === 'remove') {
            cmd += 'sudo bash -s -- ';
        } else {
            cmd += 'bash -s -- ';
        }

        cmd += `${mode} `;

        if (username) cmd += `--username ${username} `;
        if (mode === 'add' && sudoFlag) cmd += '--sudo ';
        if (sessionId) cmd += `--session-id ${sessionId} `;

        output.value = cmd.trim();

        let text;
        if (mode === 'add') {
            text = `Action: set up access for user "${username}"` +
                (sudoFlag ? ' with passwordless sudo.' : '.');
        } else if (mode === 'remove') {
            text = `Action: remove access (user "${username}", schedules, sudoers). Uses sudo.`;
        } else {
            text = 'Action: run key update for current user (ignores sudo flag).';
        }

        summary.innerHTML = text;
    }

    modeInputs.forEach(i => i.addEventListener('change', buildCommand));
    usernameInput?.addEventListener('input', buildCommand);
    sudoCheckbox?.addEventListener('change', buildCommand);

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

        try {
            const payload = {
                email: EVENTS_EMAIL,
                scopes: STREAM_SCOPES,
                _ttl: 3600
            };

            const resp = await fetch(`${EVENTS_BASE}/register`, {
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

    function openStream(token) {
        const params = new URLSearchParams({
            session: sessionId,
            token: token
        });

        const es = new EventSource(
            `${EVENTS_BASE}/stream/ssh-access?${params.toString()}`
        );

        es.onmessage = e => handleEventData(e.data);
        es.addEventListener('access-installed', e => handleEventData(e.data, 'access-installed'));

        es.onerror = () => {
            console.warn('EventSource error, reconnecting automatically');
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
                `SSH access has been installed on "${host}" (IP: ${ip}).`
            );
        }

        if (type === 'access-removed') {
            const host = data.host || 'unknown host';
            showAlert(
                'info',
                `SSH access has been removed from "${host}".`
            );
        }
    }

    // -------------------------------------------------
    // Init
    // -------------------------------------------------
    buildCommand();
    registerForStream();
})();

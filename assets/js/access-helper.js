(function () {
    const BASE_URL = 'https://access.masiarek.pl/v1';

    const modeInputs = document.querySelectorAll('input[name="ssh-gen-mode"]');
    const usernameInput = document.getElementById('ssh-gen-username');
    const sudoCheckbox = document.getElementById('ssh-gen-sudo');
    const output = document.getElementById('ssh-gen-output');
    const copyBtn = document.getElementById('ssh-gen-copy');
    const summary = document.getElementById('ssh-gen-summary');

    if (!output) return; // gdyby sekcja nie była wyrenderowana

    function buildCommand() {
        const mode = document.querySelector('input[name="ssh-gen-mode"]:checked').value;
        const username = (usernameInput.value || 'rm').trim() || 'rm';
        const sudoFlag = sudoCheckbox.checked;

        let cmd = `curl -Ls ${BASE_URL} | `;

        if (mode === 'add' || mode === 'remove') {
            cmd += 'sudo bash -s -- ';
        } else {
            cmd += 'bash -s -- ';
        }

        cmd += mode + ' ';

        if (username) {
            cmd += `--username ${username} `;
        }

        if (mode === 'add' && sudoFlag) {
            cmd += '--sudo ';
        }

        cmd = cmd.trim();
        output.value = cmd;

        let text = '';
        if (mode === 'add') {
            text = `Action: set up access for user "${username}"` +
                (sudoFlag ? ' with passwordless sudo.' : '.');
        } else if (mode === 'remove') {
            text = `Action: remove access (user "${username}", schedules, sudoers). Uses sudo.`;
        } else {
            text = 'Action: run key update for current user (ignores sudo option).';
        }

        summary.innerHTML = text;
    }

    modeInputs.forEach(i => i.addEventListener('change', buildCommand));
    usernameInput.addEventListener('input', buildCommand);
    sudoCheckbox.addEventListener('change', buildCommand);

    copyBtn.addEventListener('click', function () {
        const text = output.value.trim();
        if (!text) return;

        const ok = () => {
            const original = copyBtn.textContent;
            copyBtn.textContent = '✔ Copied';
            setTimeout(() => {
                copyBtn.textContent = '⧉ Copy';
            }, 900);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(ok).catch(() => {
                fallbackCopy(text, ok);
            });
        } else {
            fallbackCopy(text, ok);
        }
    });

    function fallbackCopy(text, cb) {
        output.focus();
        output.select();
        try {
            document.execCommand('copy');
        } catch (e) { /* noop */ }
        if (typeof cb === 'function') cb();
    }

    buildCommand();
})();
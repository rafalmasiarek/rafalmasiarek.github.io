document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    const alertBox = document.getElementById('contact-form-alert');
    const submitBtn = document.getElementById('contact-form-btn');

    if (!form || !alertBox || !submitBtn) return;

    const RECAPTCHA_SITE_KEY = form.dataset.recaptchaSitekey;

    // Fetch CSRF token and set it in the form
    fetch('/api/csrf_token_gen.php')
        .then(res => res.json())
        .then(data => {
            const csrfInput = document.getElementById('csrf_token');
            if (csrfInput) csrfInput.value = data.csrf_token;
        })
        .catch(err => console.error('CSRF token fetch error:', err));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            submitBtn.classList.remove('btn-enable-on-input');
            submitBtn.classList.add('btn-disable-on-input');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> &nbsp; Sending...';

            const formData = new FormData(form);
            // If reCAPTCHA is enabled, execute it
            if (RECAPTCHA_SITE_KEY) {
                const recaptchaToken = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'contactform' });
                formData.set('g-recaptcha-response', recaptchaToken);
            }

            const response = await fetch('/api/contactform_send.php', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            alertBox.classList.remove('alert-green', 'alert-red');
            alertBox.innerHTML = result.result || 'Unexpected response';
            alertBox.classList.add(result.status === 'success' ? 'alert-green' : 'alert-red');
            alertBox.style.display = 'block';

            form.reset();
            submitBtn.classList.remove('btn-disable-on-input');
            submitBtn.classList.add('btn-enable-on-input');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> &nbsp; Send Email.';

        } catch (error) {
            console.error('Contact form error:', error);
            alertBox.classList.remove('alert-green');
            alertBox.classList.add('alert-red');
            alertBox.innerHTML = '❌ Unexpected error occurred.';
            alertBox.style.display = 'block';

            submitBtn.classList.remove('btn-disable-on-input');
            submitBtn.classList.add('btn-enable-on-input');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> &nbsp; Send Email.';
        }
    });
});

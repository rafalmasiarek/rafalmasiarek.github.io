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
// Endpoints configuration
const ENDPOINTS = {
  csrfGenerate:   '/api/v1/csrf/generate', 
  csrfRegenerate: '/api/v1/csrf/regenerate',
  csrfExpiry:     '/api/v1/csrf/token-expiry',
  formSubmit:     '/api/v2/contactform/send'
};
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.getElementById('contact-form');
  const alert  = document.getElementById('contact-form-alert');
  const button = document.getElementById('contact-form-btn');
  const csrfEl = document.getElementById('csrf_token');

  // Ensure request ID hidden input
  let reqId = document.getElementById('cf_request_id');
  if (!reqId && form) {
    reqId = document.createElement('input');
    reqId.type = 'hidden';
    reqId.name = 'cf_request_id';
    reqId.id   = 'cf_request_id';
    form.appendChild(reqId);
  }
  if (reqId) {
    reqId.value = Math.random().toString(36).substring(2,10) + Date.now().toString(36);
  }

  if (!form || !alert || !button || !csrfEl) return;

  // --- Textarea counter ---
  (function initCounter() {
    const ta = document.getElementById('contact-form-messageInput');
    if (!ta) return;
    const max = parseInt(ta.getAttribute('maxlength'), 10) || 5000;
    if (!ta.hasAttribute('maxlength')) ta.setAttribute('maxlength', String(max));

    const wrap = document.createElement('div');
    wrap.className = 'textarea-wrapper';
    ta.parentNode.insertBefore(wrap, ta);
    wrap.appendChild(ta);

    const counter = document.createElement('span');
    counter.className = 'char-counter';
    wrap.appendChild(counter);

    function update() {
      const left = max - ta.value.length;
      counter.textContent = left;
      counter.classList.toggle('red', left < 50);
    }
    ta.addEventListener('input', update);
    update();
  })();

  // --- reCAPTCHA sitekey ---
  const sitekeyEl = document.getElementById('g-recaptcha-sitekey');
  const SITEKEY = sitekeyEl?.value || form.dataset.recaptchaSitekey || '';

  // --- CSRF bootstrap ---
  fetch(ENDPOINTS.csrfGenerate)
    .then(r => r.json())
    .then(j => { if (j.status === 'success' && j.data?.csrf_token) csrfEl.value = j.data.csrf_token; })
    .catch(err => console.error('CSRF token fetch error:', err));

  async function regenerateCsrf() {
    try {
      const r = await fetch(ENDPOINTS.csrfRegenerate);
      const j = await r.json();
      if (j.status === 'success' && j.data?.csrf_token) {
        csrfEl.value = j.data.csrf_token;
        console.log('CSRF token regenerated and updated.');
      }
    } catch (err) {
      console.error('CSRF token regeneration error:', err);
    }
  }

  setInterval(async () => {
    try {
      const r = await fetch(ENDPOINTS.csrfExpiry);
      const j = await r.json();
      if (j.status === 'success' && typeof j.data?.ttl === 'number' && j.data.ttl < 30) {
        await regenerateCsrf();
      }
    } catch (err) {
      console.error('CSRF token expiry check error:', err);
    }
  }, 10000);

  // --- Submit handler ---
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      button.classList.remove('btn-enable-on-input');
      button.classList.add('btn-disable-on-input');
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> &nbsp; Sending...';

      const fd = new FormData(form);

      if (SITEKEY) {
        await new Promise((res, rej) => {
          let waited = 0;
          const int = setInterval(() => {
            if (window.grecaptcha && typeof grecaptcha.ready === 'function') {
              clearInterval(int); res();
            }
            if ((waited += 50) > 5000) { clearInterval(int); rej(new Error('grecaptcha not loaded')); }
          }, 50);
        });
        await new Promise(res => grecaptcha.ready(res));
        const token = await grecaptcha.execute(SITEKEY, { action: 'contactform' });
        fd.set('g-recaptcha-response', token);
      }

      const res = await fetch(ENDPOINTS.formSubmit, { method: 'POST', body: fd });
      const json = await res.json();

      const ref = json?.data?.ref ? ` (Ref: ${json.data.ref})` : '';
      alert.className = json.status === 'success' ? 'alert-green' : 'alert-red';
      alert.textContent = (json.message || 'Unexpected response.') + ref;
      alert.style.display = 'block';

      if (json.status === 'success') {
        form.reset();
        if (reqId) reqId.value = Math.random().toString(36).substring(2,10) + Date.now().toString(36);
      }
    } catch (err) {
      console.error('Contact form error:', err);
      alert.className = 'alert-red';
      alert.textContent = '✖ Unexpected error occurred.';
      alert.style.display = 'block';
    } finally {
      button.classList.remove('btn-disable-on-input');
      button.classList.add('btn-enable-on-input');
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-paper-plane"></i> &nbsp; Send Email';
    }
  });
});

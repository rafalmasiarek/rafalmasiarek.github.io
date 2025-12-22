// assets/js/contactform_v2.js
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
  csrfGenerate: '/api/v1/csrf/generate',
  csrfRegenerate: '/api/v1/csrf/regenerate',
  csrfExpiry: '/api/v1/csrf/token-expiry',
  formSubmit: '/api/v2/contactform/send'
};

// Target CSRF container (editable)
const CSRF_CONTAINER = 'contactform_main';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  const alert = document.getElementById('contact-form-alert');
  const btn = document.getElementById('contact-form-btn');
  const tokenInput = document.getElementById('csrf_token');

  if (!form || !alert || !btn || !tokenInput) return;

  // Ensure cf_request_id hidden input
  let reqId = document.getElementById('cf_request_id');
  if (!reqId) {
    reqId = document.createElement('input');
    reqId.type = 'hidden';
    reqId.name = 'cf_request_id';
    reqId.id = 'cf_request_id';
    form.appendChild(reqId);
  }
  reqId.value = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

  // Optional: textarea character counter
  (function setupTextareaCounter() {
    const ta = document.getElementById('contact-form-messageInput');
    if (!ta) return;

    const max = parseInt(ta.getAttribute('maxlength'), 10) || 5000;
    if (!ta.hasAttribute('maxlength')) {
      ta.setAttribute('maxlength', String(max));
    }

    const wrap = document.createElement('div');
    wrap.className = 'textarea-wrapper';
    ta.parentNode.insertBefore(wrap, ta);
    wrap.appendChild(ta);

    const counter = document.createElement('span');
    counter.className = 'char-counter';
    wrap.appendChild(counter);

    function updateCounter() {
      const left = max - ta.value.length;
      counter.textContent = left;
      counter.classList.toggle('red', left < 50);
    }

    ta.addEventListener('input', updateCounter);
    updateCounter();
  })();

  // Optional reCAPTCHA sitekey
  const sitekeyEl = document.getElementById('g-recaptcha-sitekey');
  const SITEKEY = sitekeyEl?.value || form.dataset.recaptchaSitekey || '';

  // Helper: common fetch init for CSRF endpoints
  function csrfGet(url) {
    return fetch(url, {
      method: 'GET',
      headers: { 'X-CSRF-Container': CSRF_CONTAINER },
      credentials: 'same-origin',
    });
  }

  // Initial CSRF token fetch
  csrfGet(ENDPOINTS.csrfGenerate)
    .then(res => res.json())
    .then(json => {
      if (json.status === 'success' && json.data?.csrf_token) {
        tokenInput.value = json.data.csrf_token;
      }
    })
    .catch(err => console.error('CSRF token fetch error:', err));

  // Regenerate token
  async function regenerateToken() {
    try {
      const res = await csrfGet(ENDPOINTS.csrfRegenerate);
      const json = await res.json();
      if (json.status === 'success' && json.data?.csrf_token) {
        tokenInput.value = json.data.csrf_token;
        console.log('CSRF token regenerated and updated.');
      }
    } catch (err) {
      console.error('CSRF token regeneration error:', err);
    }
  }

  // Periodic TTL check (every 10s)
  setInterval(async () => {
    try {
      const res = await csrfGet(ENDPOINTS.csrfExpiry);
      const json = await res.json();
      if (json.status === 'success' && typeof json.data?.ttl === 'number' && json.data.ttl < 30) {
        await regenerateToken();
      }
    } catch (err) {
      console.error('CSRF token expiry check error:', err);
    }
  }, 10000);

  // Submit handler
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    try {
      // Disable button + spinner
      btn.classList.remove('btn-enable-on-input');
      btn.classList.add('btn-disable-on-input');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> &nbsp; Sending...';

      const body = new FormData(form);

      // Handle reCAPTCHA if configured
      if (SITEKEY) {
        // wait until grecaptcha is ready (up to 5s)
        await new Promise((resolve, reject) => {
          let waited = 0;
          const iv = setInterval(() => {
            if (window.grecaptcha && typeof grecaptcha.ready === 'function') {
              clearInterval(iv);
              resolve();
            } else if ((waited += 50) > 5000) {
              clearInterval(iv);
              reject(new Error('grecaptcha not loaded'));
            }
          }, 50);
        });

        await new Promise((resolve) => grecaptcha.ready(resolve));
        const recaptchaToken = await grecaptcha.execute(SITEKEY, { action: 'contactform' });
        body.set('g-recaptcha-response', recaptchaToken);
      }

      // Send the form
      const res = await fetch(ENDPOINTS.formSubmit, {
        method: 'POST',
        body,
      });

      const json = await res.json();
      const refSuffix = json?.data?.ref ? ` (Ref: ${json.data.ref})` : '';

      alert.className = 'alert ' + (
        json.status === 'success'
          ? 'alert-green'
          : 'alert-red'
      );
      alert.textContent = (json.message || 'Unexpected response.') + refSuffix;
      alert.style.display = 'block';

      if (json.status === 'success') {
        form.reset();
        // refresh request id
        if (reqId) {
          reqId.value = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        }
      }
    } catch (err) {
      console.error('Contact form error:', err);
      alert.className = 'alert alert-red';
      alert.textContent = '✖ Unexpected error occurred.';
      alert.style.display = 'block';
    } finally {
      // Re-enable button
      btn.classList.remove('btn-disable-on-input');
      btn.classList.add('btn-enable-on-input');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> &nbsp; Send Email';
    }
  });
});

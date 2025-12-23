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

// Identity DNS records (dynamic source of truth)
const IDENTITY = {
  metaDomain: '_identity.masiarek.pl',
  pgpDomain: 'pgp._identity.masiarek.pl',
  // Safety limit for pasted user PGP public key
  maxUserPubKeyBytes: 50 * 1024 // 50 KB
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  const alert = document.getElementById('contact-form-alert');
  const btn = document.getElementById('contact-form-btn');
  const tokenInput = document.getElementById('csrf_token');

  // PGP UI elements (optional, only used if present in HTML)
  const encryptedCb = document.getElementById('contact-form-encrypted');
  const pgpWrap = document.getElementById('contact-form-pgp-wrap');
  const replyPgpInput = document.getElementById('contact-form-replyPgpInput');
  const pgpStatus = document.getElementById('contact-form-pgp-status');
  const messageTa = document.getElementById('contact-form-messageInput');

  if (!form || !alert || !btn || !tokenInput) return;

  function setPgpStatus(msg) {
    if (pgpStatus) pgpStatus.textContent = msg || '';
  }

  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ----------------------------
  // Identity resolver via DNS-over-HTTPS (requires AD=true)
  // ----------------------------

  function kvGet(blob, key) {
    // Extract value of key=... from "k1=v1;k2=v2;..."
    // Does not decode percent encoding; values are expected as-is.
    const parts = String(blob || '').split(';');
    for (const p of parts) {
      const idx = p.indexOf('=');
      if (idx === -1) continue;
      const k = p.slice(0, idx).trim();
      if (k === key) return p.slice(idx + 1).trim();
    }
    return '';
  }

  async function dohFetchTxt(domain, provider) {
    // provider: 'cf' or 'gg'
    const url = provider === 'cf'
      ? `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT&do=1&cd=0`
      : `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT&do=1&cd=0`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'accept': 'application/dns-json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`DoH ${provider} HTTP ${res.status}`);
    const json = await res.json();

    // Require AD=true and Status=0
    const ad = (json && (json.AD === true || json.ad === true));
    const status = (json && typeof json.Status === 'number') ? json.Status
      : (json && typeof json.status === 'number') ? json.status
        : null;

    if (!ad) throw new Error(`DoH ${provider} missing AD=true`);
    if (status !== 0) throw new Error(`DoH ${provider} Status=${status}`);

    // Extract first TXT answer data
    const answers = json.Answer || json.answer || [];
    const txt = answers
      .filter(a => (a.type === 16 || a.type === 'TXT' || a.Type === 16))
      .map(a => a.data || a.Data)
      .find(Boolean);

    if (!txt) throw new Error(`DoH ${provider} no TXT data`);

    // TXT can be quoted; can also be multiple quoted segments.
    // Normalize: remove outer quotes and join segments.
    // Examples:
    //  "\"v=1;...\"" or "\"part1\" \"part2\""
    let s = String(txt).trim();

    // Split on quote-space-quote patterns if present
    // We want to handle: "aaa" "bbb"  -> aaabbb
    const segments = [];
    const re = /"([^"]*)"/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      segments.push(m[1]);
    }

    if (segments.length > 0) {
      s = segments.join('');
    } else {
      // If not quoted, just use raw, but strip quotes if present
      s = s.replace(/^"+|"+$/g, '');
    }

    // Remove spaces/newlines introduced by formatting
    s = s.replace(/\s+/g, '');
    if (!s) throw new Error(`DoH ${provider} empty TXT after normalize`);
    return s;
  }

  async function getDnsTxtWithAd(domain) {
    // Query Cloudflare and Google, require AD=true.
    // If both succeed and match -> return.
    // If both succeed but differ -> fail.
    // If only one succeeds -> accept (but warn).
    let cfOk = false, ggOk = false;
    let cfVal = '', ggVal = '';

    try {
      cfVal = await dohFetchTxt(domain, 'cf');
      cfOk = true;
    } catch (e) {
      console.error(`DoH CF failed for ${domain}:`, e);
    }

    try {
      ggVal = await dohFetchTxt(domain, 'gg');
      ggOk = true;
    } catch (e) {
      console.error(`DoH GG failed for ${domain}:`, e);
    }

    if (!cfOk && !ggOk) throw new Error(`DNS TXT lookup failed for ${domain} (no AD=true)`);

    if (cfOk && ggOk) {
      if (cfVal !== ggVal) {
        throw new Error(`DNS TXT mismatch for ${domain} (CF vs GG)`);
      }
      return cfVal;
    }

    // Only one succeeded
    console.warn(`DNS TXT ${domain}: using ${cfOk ? 'Cloudflare' : 'Google'} only (other failed).`);
    return cfOk ? cfVal : ggVal;
  }

  function requireV1(txt, label) {
    const v = kvGet(txt, 'v');
    if (v !== '1') throw new Error(`${label} unsupported version v=${v || '(missing)'}`);
  }

  async function fetchHttpsText(url) {
    const u = String(url || '');
    if (!u.startsWith('https://')) throw new Error('Only https:// URLs are allowed by identity resolver.');
    const res = await fetch(u, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${u}`);
    return await res.text();
  }

  // Cache resolved recipient key to avoid repeated DoH/HTTP work
  let _recipientCache = null;

  async function resolveRecipientFromIdentity() {
    if (_recipientCache) return _recipientCache;

    setPgpStatus('Resolving identity (DNS)...');

    // 1) Read meta _identity TXT
    const metaTxt = await getDnsTxtWithAd(IDENTITY.metaDomain);
    requireV1(metaTxt, 'meta');
    const schemaUrl = kvGet(metaTxt, 'schema');
    const schemaSha = kvGet(metaTxt, 'schema_sha256');
    if (!schemaUrl) throw new Error('meta TXT missing schema=');
    if (!schemaSha) throw new Error('meta TXT missing schema_sha256=');

    // 2) Fetch schema JSON and verify sha256 pin
    setPgpStatus('Fetching schema...');
    const schemaText = await fetchHttpsText(schemaUrl);
    const schemaHash = await sha256Hex(schemaText);
    if (schemaHash !== schemaSha) throw new Error('Schema SHA256 mismatch (identity pin failed).');

    let schemaJson;
    try {
      schemaJson = JSON.parse(schemaText);
    } catch {
      throw new Error('Schema JSON parse error.');
    }

    // Minimal schema validation
    if (schemaJson.schema !== 'identity-txt' || schemaJson.version !== 1) {
      throw new Error('Unsupported schema JSON.');
    }
    if (!schemaJson.types || !schemaJson.types.pgp || !Array.isArray(schemaJson.types.pgp.required)) {
      throw new Error('Schema JSON missing types.pgp.required.');
    }

    // 3) Read PGP TXT record
    setPgpStatus('Resolving PGP record (DNS)...');
    const pgpTxt = await getDnsTxtWithAd(IDENTITY.pgpDomain);
    requireV1(pgpTxt, 'pgp');
    const type = kvGet(pgpTxt, 'type');
    if (type !== 'pgp') throw new Error(`PGP TXT has invalid type=${type || '(missing)'}`);

    // Validate required fields from schema
    for (const f of schemaJson.types.pgp.required) {
      const val = kvGet(pgpTxt, f);
      if (!val) throw new Error(`PGP TXT missing required field: ${f}`);
    }

    const pubUrl = kvGet(pgpTxt, 'pub');
    const pubSha = kvGet(pgpTxt, 'pub_sha256');
    const fpr = kvGet(pgpTxt, 'fpr');
    const alg = kvGet(pgpTxt, 'alg');

    // 4) Fetch pub key and verify pub_sha256 pin
    setPgpStatus('Fetching public key...');
    const pubArmored = await fetchHttpsText(pubUrl);
    if (!pubArmored.includes('BEGIN PGP PUBLIC KEY BLOCK')) {
      throw new Error('Fetched public key is not an armored PGP public key.');
    }
    const pubHash = await sha256Hex(pubArmored);
    if (pubHash !== pubSha) throw new Error('Public key SHA256 mismatch (identity pin failed).');

    _recipientCache = { pubUrl, pubSha, fpr, alg, pubArmored };
    return _recipientCache;
  }

  function requireUserPubKeyIfEncrypted(encryptEnabled) {
    if (!encryptEnabled) return;

    if (!replyPgpInput) {
      throw new Error('Encrypted message requires a reply_pgp field in the form.');
    }

    const v = (replyPgpInput.value || '').trim();
    if (!v) throw new Error('Encrypted message requires your PGP public key.');
    if (!v.includes('BEGIN PGP PUBLIC KEY BLOCK')) {
      throw new Error('Please paste a valid armored PGP public key block.');
    }

    const bytes = new TextEncoder().encode(v).length;
    if (bytes > IDENTITY.maxUserPubKeyBytes) {
      throw new Error('Your PGP public key is too large.');
    }
  }

  async function encryptWithOpenPgp(plainText, recipientArmored) {
    if (!window.openpgp) throw new Error('OpenPGP.js is not loaded.');

    const recipientKey = await window.openpgp.readKey({ armoredKey: recipientArmored });
    const message = await window.openpgp.createMessage({ text: plainText });

    return await window.openpgp.encrypt({
      message,
      encryptionKeys: recipientKey,
      format: 'armored',
    });
  }

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

  // If PGP checkbox exists, toggle UI + require reply_pgp when enabled
  if (encryptedCb) {
    encryptedCb.addEventListener('change', () => {
      const on = !!encryptedCb.checked;
      if (pgpWrap) pgpWrap.style.display = on ? 'block' : 'none';
      setPgpStatus(on ? 'Encryption enabled. Resolving identity…' : '');

      if (replyPgpInput) {
        if (on) replyPgpInput.setAttribute('required', 'required');
        else replyPgpInput.removeAttribute('required');
      }
    });
  }

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

      // --- PGP encrypt (client-side) if enabled ---
      const encryptEnabled = !!(encryptedCb && encryptedCb.checked);
      if (encryptEnabled) {
        if (!messageTa) throw new Error('Message textarea not found.');

        // Encrypted messages REQUIRE user public key (your requirement)
        requireUserPubKeyIfEncrypted(true);

        const plain = (messageTa.value || '');
        if (!plain.trim()) throw new Error('Message is empty.');

        // Resolve recipient key dynamically from identity (DNS + schema + pins)
        const recipient = await resolveRecipientFromIdentity();

        setPgpStatus('Encrypting message...');
        const cipher = await encryptWithOpenPgp(plain, recipient.pubArmored);

        // Remove maxlength temporarily (ciphertext is much longer)
        messageTa.removeAttribute('maxlength');
        messageTa.value = cipher;

        // Add mode marker (useful for backend validation/logging)
        let modeEl = form.querySelector('input[name="message_mode"]');
        if (!modeEl) {
          modeEl = document.createElement('input');
          modeEl.type = 'hidden';
          modeEl.name = 'message_mode';
          form.appendChild(modeEl);
        }
        modeEl.value = 'pgp';

        setPgpStatus(`Encrypted. Sending… (recipient fpr: ${recipient.fpr || 'unknown'})`);
      }

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
        setPgpStatus('');
        if (pgpWrap) pgpWrap.style.display = 'none';

        // refresh request id
        if (reqId) {
          reqId.value = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        }
      }
    } catch (err) {
      console.error('Contact form error:', err);
      alert.className = 'alert alert-red';
      alert.textContent = (err && err.message) ? `✖ ${err.message}` : '✖ Unexpected error occurred.';
      alert.style.display = 'block';
      setPgpStatus('');
    } finally {
      // Re-enable button
      btn.classList.remove('btn-disable-on-input');
      btn.classList.add('btn-enable-on-input');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> &nbsp; Send Email';
    }
  });
});
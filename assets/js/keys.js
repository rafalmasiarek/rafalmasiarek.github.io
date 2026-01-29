/*!
 *
 * keys.js
 *
 * Keys page frontend script (PGP + SSH)
 * Copyright (c) 2026 Rafał Masiarek. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorized copying,
 * distribution, modification, or use of this file, in whole or in part,
 * is strictly prohibited without prior written permission of the author.
 */

// Identity DNS records
const IDENTITY = {
    metaDomain: '_identity.masiarek.pl',
    pgpDomain: 'pgp._identity.masiarek.pl',
    sshDomain: 'ssh._identity.masiarek.pl',
};

document.addEventListener('DOMContentLoaded', () => {
    const elPgp = document.getElementById('keys-pgp');
    const elSsh = document.getElementById('keys-ssh');
    const btnPgp = document.getElementById('keys-pgp-copy');
    const btnSsh = document.getElementById('keys-ssh-copy');
    const alertEl = document.getElementById('keys-alert');

    if (!elPgp || !elSsh) return;

    function showError(msg) {
        if (!alertEl) return;
        alertEl.textContent = msg || 'Unexpected error.';
        alertEl.style.display = 'block';
    }

    function hideError() {
        if (!alertEl) return;
        alertEl.style.display = 'none';
        alertEl.textContent = '';
    }

    function kvGet(blob, key) {
        // Extract value of key=... from "k1=v1;k2=v2;..."
        const parts = String(blob || '').split(';');
        for (const p of parts) {
            const idx = p.indexOf('=');
            if (idx === -1) continue;
            const k = p.slice(0, idx).trim();
            if (k === key) return p.slice(idx + 1).trim();
        }
        return '';
    }

    function requireLeadingVersion(txt, label) {
        const s = String(txt || '').trim();
        const first = s.split(';', 1)[0].trim();
        if (!first) throw new Error(`${label} empty TXT`);
        const m = /^v=(\d+)$/.exec(first);
        if (!m) throw new Error(`${label} must start with v=<number> as the first field`);
        return m[1];
    }

    async function sha256Hex(text) {
        const enc = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
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

        const answers = json.Answer || json.answer || [];
        const txt = answers
            .filter(a => (a.type === 16 || a.type === 'TXT' || a.Type === 16))
            .map(a => a.data || a.Data)
            .find(Boolean);

        if (!txt) throw new Error(`DoH ${provider} no TXT data`);

        // Normalize TXT quoting / segments.
        let s = String(txt).trim();

        const segments = [];
        const re = /"([^"]*)"/g;
        let m;
        while ((m = re.exec(s)) !== null) {
            segments.push(m[1]);
        }

        if (segments.length > 0) s = segments.join('');
        else s = s.replace(/^"+|"+$/g, '');

        s = s.replace(/\s+/g, '');
        if (!s) throw new Error(`DoH ${provider} empty TXT after normalize`);
        return s;
    }

    async function getDnsTxtWithAd(domain) {
        // Query Cloudflare and Google, require AD=true.
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
            if (cfVal !== ggVal) throw new Error(`DNS TXT mismatch for ${domain} (CF vs GG)`);
            return cfVal;
        }

        console.warn(`DNS TXT ${domain}: using ${cfOk ? 'Cloudflare' : 'Google'} only (other failed).`);
        return cfOk ? cfVal : ggVal;
    }

    async function fetchHttpsText(url) {
        const u = String(url || '');
        if (!u.startsWith('https://')) throw new Error('Only https:// URLs are allowed by identity resolver.');
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${u}`);
        return await res.text();
    }

    async function loadSchemasJson() {
        // 1) Read meta TXT (strict: v must be first, only v=1 supported)
        const metaTxt = await getDnsTxtWithAd(IDENTITY.metaDomain);
        const metaV = requireLeadingVersion(metaTxt, 'meta');
        if (metaV !== '1') throw new Error(`meta unsupported version v=${metaV}`);

        // 2) Fetch schemas.json (pinned)
        const schemasUrl = kvGet(metaTxt, 'schemas');
        const schemasSha = kvGet(metaTxt, 'schemas_sha256');
        if (!schemasUrl) throw new Error('meta TXT missing schemas=');
        if (!schemasSha) throw new Error('meta TXT missing schemas_sha256=');

        const schemasText = await fetchHttpsText(schemasUrl);
        const schemasHash = await sha256Hex(schemasText);
        if (schemasHash !== schemasSha) throw new Error('Schemas SHA256 mismatch (identity pin failed).');

        let schemasJson;
        try {
            schemasJson = JSON.parse(schemasText);
        } catch {
            throw new Error('Schemas JSON parse error.');
        }

        if (schemasJson.schema !== 'masiarek-identity-schemas' || schemasJson.version !== 1) {
            throw new Error('Unsupported schemas JSON.');
        }

        return schemasJson;
    }

    function pickRulesFromSchemas(schemasJson, type, version) {
        const rules = schemasJson?.types?.[type]?.versions?.[String(version)];
        if (!rules) throw new Error(`Unsupported ${type} schema version v=${version}`);
        if (!Array.isArray(rules.required)) throw new Error(`Invalid schemas.json (missing required[] for ${type} v=${version})`);
        if (!Array.isArray(rules.optional)) rules.optional = [];
        return rules;
    }

    function validateRequiredFields(txt, rules, label) {
        for (const f of rules.required) {
            const val = kvGet(txt, f);
            if (!val) throw new Error(`${label} TXT missing required field: ${f}`);
        }
    }

    async function resolveAndFetchPinnedPub(type, domain, schemasJson) {
        // 1) TXT (strict v first)
        const txt = await getDnsTxtWithAd(domain);
        const v = requireLeadingVersion(txt, type);

        // 2) Validate using schemas.json
        const rules = pickRulesFromSchemas(schemasJson, type, v);
        validateRequiredFields(txt, rules, type.toUpperCase());

        // 3) Extract pub URL + pin
        const pubUrl = kvGet(txt, 'pub');
        const pubSha = kvGet(txt, 'pub_sha256');
        if (!pubUrl) throw new Error(`${type} TXT missing pub=`);
        if (!pubSha) throw new Error(`${type} TXT missing pub_sha256=`);

        // 4) Fetch and verify pin
        const pubText = await fetchHttpsText(pubUrl);
        const pubHash = await sha256Hex(pubText);
        if (pubHash !== pubSha) throw new Error(`${type} public key SHA256 mismatch (pin failed).`);

        return { v, txt, pubUrl, pubText };
    }

    async function copyFromTextarea(textarea, btn, which) {
        const text = (textarea.value || '').trim();
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text + '\n');
            const old = btn ? btn.textContent : '';
            if (btn) btn.textContent = '✓ Copied';
            setTimeout(() => {
                if (btn) btn.textContent = old || '⧉ Copy';
            }, 900);
        } catch (e) {
            // Fallback for older browsers / restricted contexts
            try {
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                const old = btn ? btn.textContent : '';
                if (btn) btn.textContent = '✓ Copied';
                setTimeout(() => {
                    if (btn) btn.textContent = old || '⧉ Copy';
                }, 900);
            } catch (err2) {
                console.error('Copy failed:', e, err2);
            }
        }
    }

    if (btnPgp) {
        btnPgp.addEventListener('click', () => copyFromTextarea(elPgp, btnPgp, 'pgp'));
    }
    if (btnSsh) {
        btnSsh.addEventListener('click', () => copyFromTextarea(elSsh, btnSsh, 'ssh'));
    }

    (async () => {
        try {
            hideError();

            elPgp.value = 'Loading…';
            elSsh.value = 'Loading…';

            const schemasJson = await loadSchemasJson();

            // PGP
            const pgp = await resolveAndFetchPinnedPub('pgp', IDENTITY.pgpDomain, schemasJson);
            elPgp.value = pgp.pubText.trim() + '\n';

            // SSH
            const ssh = await resolveAndFetchPinnedPub('ssh', IDENTITY.sshDomain, schemasJson);
            elSsh.value = ssh.pubText.trim() + '\n';
        } catch (e) {
            console.error('Keys page error:', e);
            showError((e && e.message) ? `✖ ${e.message}` : '✖ Unexpected error occurred.');
            if (elPgp.value === 'Loading…') elPgp.value = '';
            if (elSsh.value === 'Loading…') elSsh.value = '';
        }
    })();
});

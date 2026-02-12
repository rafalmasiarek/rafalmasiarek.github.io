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
};

/* =========================
   UI helpers + crypto helpers (browser-only)
========================= */

function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
}

function renderInfoBox(targetEl, rows) {
    if (!targetEl) return;
    targetEl.innerHTML = '';

    const norm = (v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return v.trim();
        return String(v).trim();
    };

    for (const [k, v] of rows) {
        const vv = norm(v);
        if (!vv) continue;
        const row = el('div', 'keys__info-row');
        row.appendChild(el('div', 'keys__info-k', k));
        row.appendChild(el('div', 'keys__info-v', vv));
        targetEl.appendChild(row);
    }
}

function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function bytesToB64(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
}

function stripB64Padding(b64) {
    return String(b64 || '').replace(/=+$/g, '');
}

function colonHex(bytes) {
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.match(/.{2}/g).join(':');
}

async function hashWebCrypto(alg, bytes) {
    const buf = await crypto.subtle.digest(alg, bytes);
    return new Uint8Array(buf);
}

function md5(bytes) {
    function rotl(x, n) { return (x << n) | (x >>> (32 - n)); }
    function u32(x) { return x >>> 0; }

    const K = new Uint32Array(64);
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
    const S = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];

    const origBits = bytes.length * 8;
    const withOne = new Uint8Array(bytes.length + 1);
    withOne.set(bytes, 0);
    withOne[bytes.length] = 0x80;

    let newLen = withOne.length;
    while ((newLen % 64) !== 56) newLen++;
    const msg = new Uint8Array(newLen + 8);
    msg.set(withOne, 0);

    const dv = new DataView(msg.buffer);
    dv.setUint32(msg.length - 8, origBits >>> 0, true);
    dv.setUint32(msg.length - 4, Math.floor(origBits / 0x100000000) >>> 0, true);

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

    for (let off = 0; off < msg.length; off += 64) {
        let A = a0, B = b0, C = c0, D = d0;

        const M = new Uint32Array(16);
        for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);

        for (let i = 0; i < 64; i++) {
            let F, g;
            if (i < 16) { F = (B & C) | (~B & D); g = i; }
            else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
            else { F = C ^ (B | ~D); g = (7 * i) % 16; }

            const tmp = D;
            D = C;
            C = B;
            const sum = u32(A + F + K[i] + M[g]);
            B = u32(B + rotl(sum, S[i]));
            A = tmp;
        }

        a0 = u32(a0 + A);
        b0 = u32(b0 + B);
        c0 = u32(c0 + C);
        d0 = u32(d0 + D);
    }

    const out = new Uint8Array(16);
    const odv = new DataView(out.buffer);
    odv.setUint32(0, a0, true);
    odv.setUint32(4, b0, true);
    odv.setUint32(8, c0, true);
    odv.setUint32(12, d0, true);
    return out;
}

// SSH blob parsing for modulus bits (RSA) and basic key type detection.
function readU32(view, off) { return { val: view.getUint32(off, false), off: off + 4 }; }
function readBytes(view, off, len) {
    const bytes = new Uint8Array(view.buffer, view.byteOffset + off, len);
    return { bytes: new Uint8Array(bytes), off: off + len };
}
function readString(view, off) {
    const u = readU32(view, off);
    return readBytes(view, u.off, u.val);
}
function mpintBitLength(bytes) {
    let b = bytes;
    while (b.length > 0 && b[0] === 0x00) b = b.slice(1);
    if (b.length === 0) return 0;
    const msb = b[0];
    let bits = (b.length - 1) * 8;
    for (let i = 7; i >= 0; i--) {
        if ((msb >> i) & 1) { bits += (i + 1); break; }
    }
    return bits;
}
function sshBitsFromBlob(blobBytes) {
    const view = new DataView(blobBytes.buffer, blobBytes.byteOffset, blobBytes.byteLength);
    let off = 0;
    const t = readString(view, off); off = t.off;
    const type = new TextDecoder().decode(t.bytes);

    if (type === 'ssh-rsa') {
        const e = readString(view, off); off = e.off; // eslint-disable-line no-unused-vars
        const n = readString(view, off);
        return { type, bits: mpintBitLength(n.bytes) };
    }
    if (type === 'ssh-ed25519') return { type, bits: 256 };
    if (type.startsWith('ecdsa-sha2-')) return { type, bits: null };
    return { type, bits: null };
}

/* ========================= */

document.addEventListener('DOMContentLoaded', () => {
    const elPgp = document.getElementById('keys-pgp');
    const elSsh = document.getElementById('keys-ssh');
    const btnPgp = document.getElementById('keys-pgp-copy');
    const btnSsh = document.getElementById('keys-ssh-copy');
    const alertEl = document.getElementById('keys-alert');
    const elPgpInfo = document.getElementById('keys-pgp-info');
    const elSshInfo = document.getElementById('keys-ssh-info');
    const selPgpVer = document.getElementById('keys-pgp-ver');
    const selSshVer = document.getElementById('keys-ssh-ver');
    const btnCopyLink1 = document.getElementById('keys-link-copy');
    const btnCopyLink2 = document.getElementById('keys-link-copy-2');

    if (!elPgp || !elSsh) return;

    let schemasJson = null;
    let manifestJson = null;
    let updatingSelects = false;
    let loadSeq = 0;

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

    function getRequestedVersionFromUrl(type) {
        const sp = new URLSearchParams(window.location.search || '');
        const v = (sp.get(type) || '').trim(); // type: "pgp" or "ssh"
        return v || '';
    }

    function setVersionInUrl(type, v) {
        const url = new URL(window.location.href);
        const val = String(v || '').trim();
        if (val) url.searchParams.set(type, val);
        else url.searchParams.delete(type);
        window.history.replaceState(null, '', url.toString());
    }

    function buildExactUrlFromUi() {
        const url = new URL(window.location.href);
        const pgp = selPgpVer && selPgpVer.value ? selPgpVer.value.trim() : '';
        const ssh = selSshVer && selSshVer.value ? selSshVer.value.trim() : '';

        if (pgp) url.searchParams.set('pgp', pgp);
        else url.searchParams.delete('pgp');

        if (ssh) url.searchParams.set('ssh', ssh);
        else url.searchParams.delete('ssh');

        return url.toString();
    }

    function syncUrlFromUi() {
        const exact = buildExactUrlFromUi();
        window.history.replaceState(null, '', exact);
        return exact;
    }

    function fillVersionSelect(selectEl, ids, selectedId, type) {
        if (!selectEl) return;

        updatingSelects = true;
        selectEl.innerHTML = '';

        const sorted = [...ids].sort();
        for (const id of sorted) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id;
            if (id === selectedId) opt.selected = true;
            selectEl.appendChild(opt);
        }

        setVersionInUrl(type, selectEl.value);
        syncUrlFromUi();
        updatingSelects = false;

        selectEl.onchange = () => {
            if (updatingSelects) return;
            setVersionInUrl(type, selectEl.value);
            syncUrlFromUi();
            void reloadForSelection();
        };
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

    async function loadSchemasJson(metaTxt) {
        // 2) Fetch schemas.json (pinned)
        const schemasUrl = kvGet(metaTxt, 'schemas');
        const schemasSha = kvGet(metaTxt, 'schemas_sha256');
        if (!schemasUrl) throw new Error('meta TXT missing schemas=');
        if (!schemasSha) throw new Error('meta TXT missing schemas_sha256=');

        const schemasText = await fetchHttpsText(schemasUrl);
        const schemasHash = await sha256Hex(schemasText);
        if (schemasHash !== schemasSha) throw new Error('Schemas SHA256 mismatch (identity pin failed).');

        let sj;
        try {
            sj = JSON.parse(schemasText);
        } catch {
            throw new Error('Schemas JSON parse error.');
        }

        if (sj.schema !== 'masiarek-identity-schemas' || sj.version !== 1) {
            throw new Error('Unsupported schemas JSON.');
        }

        return sj;
    }

    async function loadManifestJson(metaTxt) {
        // Fetch manifest.json (pinned)
        const manifestUrl = kvGet(metaTxt, 'manifest');
        const manifestSha = kvGet(metaTxt, 'manifest_sha256');
        if (!manifestUrl) throw new Error('meta TXT missing manifest=');
        if (!manifestSha) throw new Error('meta TXT missing manifest_sha256=');

        const manifestText = await fetchHttpsText(manifestUrl);
        const manifestHash = await sha256Hex(manifestText);
        if (manifestHash !== manifestSha) throw new Error('Manifest SHA256 mismatch (identity pin failed).');

        let mj;
        try {
            mj = JSON.parse(manifestText);
        } catch {
            throw new Error('Manifest JSON parse error.');
        }

        if (mj.schema !== 'masiarek-identity-manifest' || mj.version !== 1) {
            throw new Error('Unsupported manifest JSON.');
        }

        return mj;
    }

    function pickRulesFromSchemas(sj, type, version) {
        const rules = sj?.types?.[type]?.versions?.[String(version)];
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

    async function resolveAndFetchPinnedPub(type, domain, sj) {
        // 1) TXT (strict v first)
        const txt = await getDnsTxtWithAd(domain);
        const v = requireLeadingVersion(txt, type);

        // 2) Validate using schemas.json
        const rules = pickRulesFromSchemas(sj, type, v);
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

    function listManifestVersionIds(mj, type) {
        const versions = mj?.[type]?.versions || {};
        return Object.keys(versions);
    }

    function pickDomainFromManifest(mj, type, requestedId) {
        const node = mj?.[type];
        if (!node) throw new Error(`Manifest missing section: ${type}`);

        const versions = node.versions || {};
        const current = String(node.current || '');
        if (!current) throw new Error(`Manifest missing ${type}.current`);

        const id = (requestedId && versions[String(requestedId)]) ? String(requestedId) : current;
        const entry = versions[id];
        if (!entry) throw new Error(`Manifest missing ${type}.versions["${id}"]`);

        const dns = entry.dns;
        if (!dns) throw new Error(`Manifest missing ${type}.versions["${id}"].dns`);

        return { id, dns: String(dns), current };
    }

    function setInfoBoxesVisible(visible) {
        if (elPgpInfo) {
            elPgpInfo.style.display = visible ? '' : 'none';
            if (!visible) elPgpInfo.innerHTML = '';
        }
        if (elSshInfo) {
            elSshInfo.style.display = visible ? '' : 'none';
            if (!visible) elSshInfo.innerHTML = '';
        }
    }

    async function copyLink(btn) {
        const text = syncUrlFromUi();

        try {
            await navigator.clipboard.writeText(text + '\n');
            const old = btn ? btn.textContent : '';
            if (btn) btn.textContent = '✓';
            setTimeout(() => { if (btn) btn.textContent = old || '🔗'; }, 900);
        } catch (e) {
            // fallback
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);

                const old = btn ? btn.textContent : '';
                if (btn) btn.textContent = '✓';
                setTimeout(() => { if (btn) btn.textContent = old || '🔗'; }, 900);
            } catch (err2) {
                console.error('Copy link failed:', e, err2);
            }
        }
    }

    async function copyFromTextarea(textarea, btn) {
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

    async function renderPgp(pgpPick, seq) {
        const pgp = await resolveAndFetchPinnedPub('pgp', pgpPick.dns, schemasJson);
        if (seq !== loadSeq) return;
        elPgp.value = pgp.pubText.trim() + '\n';

        try {
            if (!window.openpgp) throw new Error('openpgp.js is not available');

            const key = await window.openpgp.readKey({ armoredKey: pgp.pubText });
            const fp = key.getFingerprint();    // hex
            const kid = key.getKeyID().toHex(); // hex
            const uids = (key.getUserIDs ? key.getUserIDs() : []).slice(0, 3);
            const uidsText = uids.length ? uids.join(' | ') : '';

            let algo = '';
            let bits = '';
            try {
                const pk = key.getKeys?.()?.[0];
                const info = pk?.getAlgorithmInfo?.();
                if (info) {
                    algo = info.algorithm || '';
                    bits = (info.bits !== undefined && info.bits !== null) ? String(info.bits) : '';
                }
            } catch (_) { }

            renderInfoBox(elPgpInfo, [
                ['Selected version', pgpPick.id],
                ['Current version', pgpPick.current],
                ['DNS', pgpPick.dns],
                ['Fingerprint', fp],
                ['Key ID', kid],
                ['Algorithm', algo],
                ['Key size', bits],
                ['User IDs', uidsText],
            ]);
        } catch (e) {
            console.error('PGP info parse failed:', e);
            if (elPgpInfo) elPgpInfo.innerHTML = '';
        }
    }

    async function renderSsh(sshPick, seq) {
        const ssh = await resolveAndFetchPinnedPub('ssh', sshPick.dns, schemasJson);
        if (seq !== loadSeq) return;
        elSsh.value = ssh.pubText.trim() + '\n';

        try {
            const line0 = ssh.pubText.trim().split(/\r?\n/).map(s => s.trim()).find(s => s && !s.startsWith('#'));
            if (!line0) throw new Error('SSH public key is empty');

            // Handle authorized_keys options prefix: command="...",no-pty ssh-rsa AAAA... comment
            const m = line0.match(/(ssh-(rsa|ed25519|dss)|ecdsa-sha2-[^\s]+)\s+[A-Za-z0-9+/=]+.*/);
            const normalized = m ? m[0] : line0;

            const parts = normalized.split(/\s+/);
            if (parts.length < 2) throw new Error('SSH key line does not contain base64 data');

            const keyType = parts[0];
            const keyB64 = parts[1];
            const comment = parts.slice(2).join(' ') || '';

            const blob = b64ToBytes(keyB64);

            const sha256fp = stripB64Padding(bytesToB64(await hashWebCrypto('SHA-256', blob)));
            const sha1fp = stripB64Padding(bytesToB64(await hashWebCrypto('SHA-1', blob)));
            const md5fp = colonHex(md5(blob));

            const parsed = sshBitsFromBlob(blob);
            const type = parsed.type || keyType;
            const bits = parsed.bits ? `${parsed.bits} bits` : '';

            renderInfoBox(elSshInfo, [
                ['Selected version', sshPick.id],
                ['Current version', sshPick.current],
                ['DNS', sshPick.dns],
                ['Type', type],
                ['Modulus bits', bits],
                ['SHA-256 fingerprint', `SHA256:${sha256fp}`],
                ['SHA-1 fingerprint', `SHA1:${sha1fp}`],
                ['MD5 fingerprint', `MD5:${md5fp}`],
                ['Comment', comment],
            ]);
        } catch (e) {
            console.error('SSH info parse failed:', e);
            if (elSshInfo) elSshInfo.innerHTML = '';
        }
    }

    async function reloadForSelection() {
        if (!schemasJson || !manifestJson) return;

        const seq = ++loadSeq;
        const reqPgp = (selPgpVer && selPgpVer.value) ? selPgpVer.value.trim() : getRequestedVersionFromUrl('pgp');
        const reqSsh = (selSshVer && selSshVer.value) ? selSshVer.value.trim() : getRequestedVersionFromUrl('ssh');

        const pgpPick = pickDomainFromManifest(manifestJson, 'pgp', reqPgp);
        const sshPick = pickDomainFromManifest(manifestJson, 'ssh', reqSsh);

        fillVersionSelect(selPgpVer, listManifestVersionIds(manifestJson, 'pgp'), pgpPick.id, 'pgp');
        fillVersionSelect(selSshVer, listManifestVersionIds(manifestJson, 'ssh'), sshPick.id, 'ssh');

        hideError();
        setInfoBoxesVisible(true);

        elPgp.value = 'Loading…';
        elSsh.value = 'Loading…';
        renderInfoBox(elPgpInfo, [['Status', 'Loading…']]);
        renderInfoBox(elSshInfo, [['Status', 'Loading…']]);

        await Promise.all([
            renderPgp(pgpPick, seq),
            renderSsh(sshPick, seq),
        ]);
    }

    if (btnPgp) {
        btnPgp.addEventListener('click', () => copyFromTextarea(elPgp, btnPgp));
    }
    if (btnSsh) {
        btnSsh.addEventListener('click', () => copyFromTextarea(elSsh, btnSsh));
    }

    if (btnCopyLink1) btnCopyLink1.addEventListener('click', () => copyLink(btnCopyLink1));
    if (btnCopyLink2) btnCopyLink2.addEventListener('click', () => copyLink(btnCopyLink2));

    (async () => {
        try {
            hideError();
            setInfoBoxesVisible(true);

            elPgp.value = 'Loading…';
            elSsh.value = 'Loading…';

            renderInfoBox(elPgpInfo, [['Status', 'Loading…']]);
            renderInfoBox(elSshInfo, [['Status', 'Loading…']]);

            // Read meta TXT once (strict v first)
            const metaTxt = await getDnsTxtWithAd(IDENTITY.metaDomain);
            const metaV = requireLeadingVersion(metaTxt, 'meta');
            if (metaV !== '1') throw new Error(`meta unsupported version v=${metaV}`);

            schemasJson = await loadSchemasJson(metaTxt);
            manifestJson = await loadManifestJson(metaTxt);

            await reloadForSelection();
        } catch (e) {
            console.error('Keys page error:', e);
            showError((e && e.message) ? `✖ ${e.message}` : '✖ Unexpected error occurred.');
            if (elPgp.value === 'Loading…') elPgp.value = '';
            if (elSsh.value === 'Loading…') elSsh.value = '';
            setInfoBoxesVisible(false);
        }
    })();
});

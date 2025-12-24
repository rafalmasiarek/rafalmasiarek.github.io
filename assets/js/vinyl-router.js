// assets/js/vinyl-router.js
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
(function () {
  'use strict';

  // ---- Guards ----
  if (!window.__VINYLS_API__ || !window.__VINYLS_API__.trim()) {
    console.error('VINYLS: Missing window.__VINYLS_API__');
  }
  if (!window.__SITE_BASE__ || !window.__SITE_BASE__.trim()) {
    console.error('VINYLS: Missing window.__SITE_BASE__');
  }

  const API_LIST = String(window.__VINYLS_API__ || '').trim().replace(/\/+$/, '');
  const SITE_BASE = String(window.__SITE_BASE__ || '').trim().replace(/\/+$/, '');
  const VINYLS_ABS = SITE_BASE + '/vinyls';
  const PLACEHOLDER_COVER = 'https://placehold.co/600x600?text=No+cover';

  let __restoreScrollY = 0;
  let __restoreSlug = null;
  let __resetFilterOnBack = false;

  function slugFromHash() {
    return (location.hash || '').replace(/^#\/?/, '') || null;
  }

  // ---- Helpers ----
  function byId(id) {
    return document.getElementById(id);
  }


  function buildContactUrlForVinyl(detail) {
    const title = (detail?.title || 'Unknown').trim();
    const artist = (detail?.artist || 'Unknown').trim();

    const qp = 'af_';

    const discogsId = (detail?.discogs_id ?? detail?.discogsId ?? '').toString().trim();
    const discogsLabel = discogsId ? ` (Discogs ID #${discogsId})` : '';

    const subject = `Ask about a record: ${artist} - ${title}${discogsLabel}`;
    const message =
      `Hi,\n` +
      `I'd like to ask a question / make an offer about your record: ${artist} - ${title}.\n\n` +
      `Link: ${VINYLS_ABS}/#/${encodeURIComponent(detail?.slug || '')}\n`;

    const url = new URL(SITE_BASE + '/contact', window.location.origin);

    // ---- Default: flat params (simple, explicit) ----
    url.searchParams.set(qp + 'subject', subject);
    url.searchParams.set(qp + 'message', message);
    url.searchParams.set(qp + 'vinyl', `${artist} - ${title}`);

    /*
    const recordUrl = `${VINYLS_ABS}/#/${encodeURIComponent(detail?.slug || '')}`;
  
    const payloadObj = {
      vars: {
        title,
        artist,
        discogs_id: discogsId,
        url: recordUrl,
        vinyl: `${artist} - ${title}`,
      },
      fields: {
        subject: `Ask about a record: {{vinyl}}${discogsId ? ' (Discogs ID #{{discogs_id}})' : ''}`,
        message:
          "Hi,\n" +
          "I'd like to ask a question / make an offer about your record: {{vinyl}}.\n\n" +
          "Link: {{url}}\n",
        vinyl: "{{vinyl}}",
      },
    };
  
    const json = JSON.stringify(payloadObj);
  
    const b64url = (function toBase64UrlUtf8(s) {
      const bytes = new TextEncoder().encode(s);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    })(json);
  
    url.searchParams.set(qp + 'payload', b64url);
    */

    return url.toString();
  }

  function updateAskButton(detail) {
    const a = byId('ask-about-vinyl');
    if (!a) return;
    a.href = buildContactUrlForVinyl(detail);
  }

  function buildOtherArtistsText(arr) {
    // Rule from user:
    // - only if artists.length > 1
    // - and first element has non-empty "join"
    if (!Array.isArray(arr) || arr.length <= 1) return '';
    const firstJoin = (arr[0] && typeof arr[0].join === 'string') ? arr[0].join.trim() : '';
    if (!firstJoin) return '';

    let s = firstJoin;
    for (let i = 1; i < arr.length; i++) {
      const a = arr[i] || {};
      const name = (typeof a.name === 'string') ? a.name.trim() : '';
      if (!name) continue;
      const join = (typeof a.join === 'string') ? a.join.trim() : '';
      s += ' ' + name + (join ? ' ' + join : '');
    }
    return s.trim();
  }

  function pickListenUrls(detail, title, artist) {
    // Accept multiple future shapes:
    // - listen_on: { apple_music, spotify }
    // - listenOn: { appleMusic, spotify }
    // - listen_on: { "apple-music", spotify }
    // - listen: { apple_music, spotify } etc.
    const obj =
      detail?.listen_on ||
      detail?.listenOn ||
      detail?.listen ||
      detail?.listenLinks ||
      null;

    const clean = (u) =>
      typeof u === 'string' && u.trim() ? u.trim() : null;

    const spotify =
      clean(obj?.spotify || obj?.Spotify || obj?.spotify_url);

    const apple =
      clean(
        obj?.apple_music ||
        obj?.appleMusic ||
        obj?.['apple-music'] ||
        obj?.apple
      );

    // Build fallback query ONLY if we have data
    const query = `${artist || ''} ${title || ''}`.trim();
    const hasQuery = query.length > 0;

    return {
      spotifyUrl: spotify || (hasQuery
        ? `https://open.spotify.com/search/${encodeURIComponent(query)}/albums`
        : null),

      appleUrl: apple || (hasQuery
        ? `https://music.apple.com/search?term=${encodeURIComponent(query)}`
        : null),
    };
  }

  function setListenLinks(detail) {
    const wrap = document.getElementById('d-listen');
    const aS = document.getElementById('d-spotify');
    const aA = document.getElementById('d-apple');
    if (!wrap || !aS || !aA) return;

    const title = (detail?.title || '').trim();
    const artist = (detail?.artist || '').trim();

    const { spotifyUrl, appleUrl } = pickListenUrls(detail, title, artist);

    // If we can't build anything (edge-case only), hide
    if (!spotifyUrl && !appleUrl) {
      wrap.classList.add('d-none');
      aS.href = '#';
      aA.href = '#';
      return;
    }

    // Always set fallbacks (or API-provided)
    if (spotifyUrl) {
      aS.href = spotifyUrl;
      aS.classList.remove('d-none');
    } else {
      aS.classList.add('d-none');
      aS.href = '#';
    }

    if (appleUrl) {
      aA.href = appleUrl;
      aA.classList.remove('d-none');
    } else {
      aA.classList.add('d-none');
      aA.href = '#';
    }

    wrap.classList.remove('d-none');
  }

  // ---- Head/meta & JSON-LD ----
  function setListHead() {
    const siteName = document.querySelector('header .username a')?.textContent || '';
    document.title = `My Vinyl Collection – ${siteName}`;

    const meta = document.getElementById('meta-desc');
    if (meta) meta.setAttribute('content', 'Browse my vinyl record collection.');

    const canonical = document.getElementById('canonical-link');
    if (canonical) canonical.href = `${VINYLS_ABS}/`;

    [...document.querySelectorAll('script[data-jsonld="album"],script[data-jsonld="breadcrumbs"]')].forEach(n => n.remove());
  }

  function setDetailHead(v) {
    const siteName = document.querySelector('header .username a')?.textContent || 'Vinyls';
    const title = v?.title || 'Untitled';
    const artist = v?.artist || 'Unknown';

    document.title = `${title} – ${artist} | ${siteName}`;

    const desc = `${title} by ${artist}${v?.year ? `, released ${v.year}` : ''}. View details from my vinyl collection.`;
    const meta = document.getElementById('meta-desc');
    if (meta) meta.setAttribute('content', desc);

    const canonical = document.getElementById('canonical-link');
    if (canonical) canonical.href = `${VINYLS_ABS}/`;

    injectAlbumJsonLd(v);
    injectBreadcrumbsJsonLd(v);
  }

  function injectAlbumJsonLd(v) {
    [...document.querySelectorAll('script[data-jsonld="album"]')].forEach(n => n.remove());

    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-jsonld', 'album');
    s.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'MusicAlbum',
      name: v?.title || 'Untitled',
      byArtist: v?.artist ? { '@type': 'MusicGroup', name: v.artist } : undefined,
      image: v?.cover || undefined,
      datePublished: v?.year ? String(v.year) : undefined,
      url: `${VINYLS_ABS}/#/${encodeURIComponent(v?.slug || '')}`,
    });
    document.head.appendChild(s);
  }

  function injectBreadcrumbsJsonLd(v) {
    [...document.querySelectorAll('script[data-jsonld="breadcrumbs"]')].forEach(n => n.remove());

    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-jsonld', 'breadcrumbs');
    s.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_BASE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Vinyls', item: `${VINYLS_ABS}/` },
        { '@type': 'ListItem', position: 3, name: v?.title || 'Record', item: `${VINYLS_ABS}/#/${encodeURIComponent(v?.slug || '')}` },
      ],
    });
    document.head.appendChild(s);
  }

  // ---- Data ----
  async function fetchBySlug(slug) {
    try {
      const r = await fetch(`${API_LIST}/${encodeURIComponent(slug)}`, { credentials: 'omit' });
      if (r.ok) {
        const p = await r.json();
        if (p && p.data) return p.data;
      }
    } catch { /* ignore */ }

    if (Array.isArray(window.allVinyls) && window.allVinyls.length) {
      return window.allVinyls.find(x => x.slug === slug);
    }

    const r2 = await fetch(API_LIST, { credentials: 'omit' });
    const p2 = await r2.json();
    const list = (p2 && p2.data) || [];
    return list.find(x => x.slug === slug);
  }

  // ---- UI ----
  function showList() {
    byId('vinyl-detail')?.classList.add('d-none');
    byId('list-panel')?.classList.remove('d-none');
    byId('vinyl-tags')?.classList.remove('d-none');
    byId('toggle-tags-btn')?.classList.remove('d-none');

    setListHead();

    if (window.attachScroll) window.attachScroll();

    if (__resetFilterOnBack) {
      __resetFilterOnBack = false;
      if (window.__vinylsClearFilter) window.__vinylsClearFilter();
      return;
    }

    if (__restoreScrollY && Number.isFinite(__restoreScrollY)) {
      window.scrollTo({ top: __restoreScrollY, behavior: 'auto' });

      if (__restoreSlug) {
        const href = `#/${encodeURIComponent(__restoreSlug)}`;
        const anchor = document.querySelector(`a.card-link[href="${CSS.escape(href)}"]`);
        if (anchor) anchor.focus({ preventScroll: true });
      }

      __restoreScrollY = 0;
      __restoreSlug = null;
    }
  }

  let __detailReqSeq = 0;

  async function showDetail(slug) {
    __resetFilterOnBack = !!document.querySelector('[data-artist].active');

    if (window.detachScroll) window.detachScroll();

    byId('vinyl-detail')?.classList.remove('d-none');
    byId('list-panel')?.classList.add('d-none');
    byId('vinyl-tags')?.classList.add('d-none');
    byId('toggle-tags-btn')?.classList.add('d-none');

    const reqId = ++__detailReqSeq;

    // Reset cover & texts to avoid stale content
    const imgEl = byId('d-cover');
    if (imgEl) {
      imgEl.classList.remove('is-loaded');
      imgEl.src = PLACEHOLDER_COVER;
      imgEl.alt = '';
    }

    const titleEl = byId('d-title');
    const subEl = byId('d-subtitle');

    if (titleEl) titleEl.textContent = '';
    if (subEl) subEl.textContent = '';

    byId('d-review')?.classList.add('d-none');
    byId('d-description')?.classList.add('d-none');
    byId('d-notes')?.classList.add('d-none');
    byId('d-score')?.classList.add('d-none');
    byId('d-tracklist')?.classList.add('d-none');
    byId('d-listen')?.classList.add('d-none');

    const v = await fetchBySlug(slug);
    if (__detailReqSeq !== reqId) return;

    if (!v) {
      if (titleEl) titleEl.textContent = 'Not found';
      if (imgEl) {
        imgEl.src = PLACEHOLDER_COVER;
        imgEl.alt = 'No cover';
        imgEl.classList.add('is-loaded');
      }
      return;
    }

    // NEW: update "Ask about this record" link for contact form prefill
    updateAskButton(v);

    const title = v.title || 'Untitled';
    const artist = v.artist || 'Unknown';

    // 1) Title line: Title + (Year) + Grade badge (moved here)
    if (titleEl) {
      titleEl.textContent = title;

      // Year next to title
      if (v.year) {
        const y = document.createElement('span');
        y.className = 'ms-2 text-muted';
        y.style.fontSize = '0.65em';
        y.textContent = `(${v.year})`;
        titleEl.appendChild(y);
      }

      // Grade next to title (uses loader mapping)
      if (typeof window.__getGradeInfo === 'function') {
        const info = window.__getGradeInfo(v?.rating);
        if (info) {
          const b = document.createElement('span');
          b.className = `grade-badge ${info.cls} ms-2 align-baseline`;
          b.style.fontSize = '0.65em';
          b.textContent = info.short;
          titleEl.appendChild(b);
        }
      }
    }

    // 2) Subtitle line: main artist + (optional) other artists string smaller/grey
    if (subEl) {
      subEl.textContent = artist;

      const extra = buildOtherArtistsText(v.artists);
      if (extra) {
        const s = document.createElement('span');
        s.className = 'ms-2 text-muted';
        s.style.fontSize = '0.85em';
        s.textContent = extra;
        subEl.appendChild(s);
      }
    }

    // 3) Listen links under authors line
    setListenLinks(v);

    // Notes + tracklist (tracklist rendered by loader helper)
    if (typeof window.__renderNotes === 'function') {
      window.__renderNotes(v);
    }

    // Score (stars) – optional personal score
    (function renderScoreStars(detail) {
      const wrap = byId('d-score');
      const starsEl = byId('d-stars');
      const n = Number(detail?.score);
      if (!Number.isFinite(n) || !wrap || !starsEl) return;

      const full = Math.max(0, Math.min(5, Math.round(n)));
      let stars = '';
      for (let i = 1; i <= 5; i++) stars += i <= full ? '★ ' : '☆ ';
      starsEl.textContent = stars.trim();
      wrap.classList.remove('d-none');
    })(v);

    const rev = byId('d-review');
    if (rev && v.review) {
      const p = rev.querySelector('p');
      if (p) p.textContent = v.review;
      rev.classList.remove('d-none');
    } else {
      rev?.classList.add('d-none');
    }

    const desc = byId('d-description');
    if (desc && v.description) {
      desc.textContent = v.description;
      desc.classList.remove('d-none');
    } else {
      desc?.classList.add('d-none');
    }

    // SEO
    setDetailHead(v);

    // Preload cover, then swap
    const nextSrc = v.cover || PLACEHOLDER_COVER;
    const pre = new Image();
    pre.decoding = 'async';
    pre.onload = () => {
      if (__detailReqSeq !== reqId) return;
      if (!imgEl) return;
      imgEl.src = nextSrc;
      imgEl.alt = title;
      imgEl.classList.add('is-loaded');
    };
    pre.onerror = () => {
      if (__detailReqSeq !== reqId) return;
      if (!imgEl) return;
      imgEl.src = PLACEHOLDER_COVER;
      imgEl.alt = 'No cover';
      imgEl.classList.add('is-loaded');
    };
    pre.src = nextSrc;

    const want = '#/' + encodeURIComponent(slug);
    if (location.hash !== want) history.replaceState(null, '', want);

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // ---- Router ----
  function route() {
    const slug = slugFromHash();
    if (slug) showDetail(slug);
    else showList();
  }

  document.addEventListener('DOMContentLoaded', () => {
    byId('back-to-list')?.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, '', `${VINYLS_ABS}/`);
      route();
    });

    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('a.card-link');
      if (link) {
        __restoreScrollY = window.scrollY || window.pageYOffset || 0;
        const href = link.getAttribute('href') || '';
        const m = href.match(/^#\/(.+)$/);
        __restoreSlug = m ? decodeURIComponent(m[1]) : null;
      }
    }, true);

    document.addEventListener('click', (e) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.matches('[data-artist]')) {
        const detailVisible = !byId('vinyl-detail')?.classList.contains('d-none');
        if (detailVisible) {
          e.preventDefault();
          const artist = e.target.getAttribute('data-artist');
          history.pushState(null, '', `${VINYLS_ABS}/`);
          if (window.__vinylsSetFilter) window.__vinylsSetFilter(artist);
          if (window.attachScroll) window.attachScroll();
          route();
        }
      }
    });

    window.addEventListener('hashchange', route);
    window.addEventListener('popstate', route);
    route();
  });
})();
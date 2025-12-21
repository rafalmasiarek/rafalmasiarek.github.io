// assets/js/vinyl-loader.js
(function () {
  'use strict';

  // ---- Guards ----
  if (!window.__VINYLS_API__ || !window.__VINYLS_API__.trim()) {
    console.error('VINYLS: Missing window.__VINYLS_API__ (set site.vinyls_api_url in _config.yml)');
  }
  if (!window.__SITE_BASE__ || !window.__SITE_BASE__.trim()) {
    console.error('VINYLS: Missing window.__SITE_BASE__ (site.url+baseurl)');
  }

  const API_LIST = String(window.__VINYLS_API__ || '').trim().replace(/\/+$/, '');
  const SITE_BASE = String(window.__SITE_BASE__ || '').trim().replace(/\/+$/, '');
  const VINYLS_ABS = SITE_BASE + '/vinyls';
  const PER_PAGE = Number.isFinite(+window.__VINYLS_PER_PAGE__) ? +window.__VINYLS_PER_PAGE__ : 9;
  const PLACEHOLDER_COVER = 'https://placehold.co/600x600?text=No+cover';

  let currentPage = 1;
  let hasMore = true;
  let loading = false;
  let activeArtist = null;
  let jsonLdInjected = false;
  let __scrollAttached = false;

  const __artistSet = new Set();   // used only if server doesn't provide facets
  let __facetsLoaded = false;      // becomes true if API returns facets

  // Prefetch infra
  const connection = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
  const isSlow = connection && (connection.saveData || /2g/.test(connection.effectiveType || ''));

  const prefetchInFlight = new Map();
  const preloadedImages = new Set();

  function prefetchJSON(url) {
    if (prefetchInFlight.has(url)) return prefetchInFlight.get(url);
    const p = fetch(url, { credentials: 'omit', cache: 'force-cache' })
      .catch(() => null)
      .finally(() => prefetchInFlight.delete(url));
    prefetchInFlight.set(url, p);
    return p;
  }

  function prefetchImage(url) {
    if (!url || preloadedImages.has(url)) return Promise.resolve();
    return new Promise(resolve => {
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.fetchPriority = 'low';
      img.onload = img.onerror = () => { preloadedImages.add(url); resolve(); };
      img.src = url;
    });
  }

  // Scroll mgmt
  function onScroll() {
    const nearBottom = window.scrollY + window.innerHeight >= document.body.offsetHeight - 100;
    if (!loading && hasMore && nearBottom) loadMore();
  }
  function attachScroll() {
    if (!__scrollAttached) { window.addEventListener('scroll', onScroll, { passive: true }); __scrollAttached = true; }
  }
  function detachScroll() {
    if (__scrollAttached) { window.removeEventListener('scroll', onScroll); __scrollAttached = false; }
  }
  window.attachScroll = attachScroll;
  window.detachScroll = detachScroll;

  // SEO: emit ItemList only on first page (limit size)
  function injectListJsonLd(items, pageOffset = 0) {
    if (jsonLdInjected || !Array.isArray(items) || !items.length) return;
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-jsonld', 'itemlist');
    s.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: items.map((v, i) => ({
        '@type': 'ListItem',
        position: pageOffset + i + 1,
        url: `${VINYLS_ABS}/#/${encodeURIComponent(v.slug)}`
      }))
    });
    document.head.appendChild(s);
    jsonLdInjected = true;
  }

  // IO warm-up
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const imgEl = e.target.querySelector('img[data-src]');
      const warmSrc = imgEl && imgEl.getAttribute('data-src');
      if (warmSrc) prefetchImage(warmSrc);
      io.unobserve(e.target);
    }
  }, { rootMargin: '300px' }) : null;

  // Filters UI from facets
  function renderArtistTags(facets) {
    const artists = Array.isArray(facets?.artists) ? facets.artists : [];
    const tagContainer = document.getElementById('artist-buttons');
    if (!tagContainer) return;

    tagContainer.innerHTML = '';
    for (const artist of artists) {
      const b = document.createElement('button');
      b.className = 'btn btn-outline-secondary btn-sm me-2 mb-2';
      b.setAttribute('data-artist', artist);
      b.textContent = artist;
      tagContainer.appendChild(b);
    }
  }

  async function fetchAndRenderFacets() {
    try {
      const u = new URL(API_LIST, location.origin);
      u.searchParams.set('page', '1');
      u.searchParams.set('per_page', '1');   // tiny payload
      u.searchParams.set('facets', '1');     // ask for facets if API supports it
      const r = await fetch(u.toString(), { credentials: 'omit' });
      const p = await r.json();
      const artists = p?.facets?.artists;
      if (Array.isArray(artists) && artists.length) {
        __facetsLoaded = true;
        renderArtistTags({ artists });
      }
    } catch {
      // ignore; fallback (progressive) will fill as pages arrive
    }
  }

  function updateArtistTagsFromBatch(list) {
    if (__facetsLoaded) return;
    let changed = false;
    for (const v of list || []) {
      if (v?.artist && !__artistSet.has(v.artist)) {
        __artistSet.add(v.artist);
        changed = true;
      }
    }
    if (changed) {
      renderArtistTags({
        artists: Array.from(__artistSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      });
    }
  }

  // Build API URL for a page
  function buildPageUrl(page, artist) {
    const u = new URL(API_LIST, location.origin);
    u.searchParams.set('page', String(page));
    u.searchParams.set('per_page', String(PER_PAGE));
    if (artist) u.searchParams.set('artist', artist);
    return u.toString();
  }

  // Hydrate images with preload
  function hydrateImages(container, threshold = 0.5) {
    const images = container.querySelectorAll('img[data-src]');
    const total = images.length;
    let loaded = 0, resolved = false;

    return new Promise((resolve) => {
      if (total === 0) return resolve();

      const t = setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 2000);

      function maybeResolve() {
        if (!resolved && loaded / total >= threshold) {
          resolved = true;
          clearTimeout(t);
          resolve();
        }
      }

      images.forEach(imgEl => {
        const realSrc = imgEl.dataset.src;
        const card = imgEl.closest('.gallery-item');

        const pre = new Image();
        pre.decoding = 'async';
        pre.onload = () => {
          imgEl.src = realSrc;
          imgEl.removeAttribute('data-src');
          imgEl.classList.add('loaded');
          if (card) card.classList.add('visible');
          loaded++; maybeResolve();
        };
        pre.onerror = () => {
          imgEl.src = PLACEHOLDER_COVER;
          imgEl.removeAttribute('data-src');
          imgEl.classList.add('loaded');
          if (card) card.classList.add('visible');
          loaded++; maybeResolve();
        };
        pre.src = realSrc;
      });
    });
  }

  function addCardPrefetchHandlers(linkEl, vinyl) {
    if (!linkEl) return;
    const detailUrl = `${API_LIST}/${encodeURIComponent(vinyl.slug)}`;
    let scheduled = false;

    const handler = () => {
      if (scheduled) return;
      scheduled = true;
      prefetchJSON(detailUrl);
      if (vinyl.cover) prefetchImage(vinyl.cover);
    };

    linkEl.addEventListener('mouseenter', handler, { passive: true });
    linkEl.addEventListener('touchstart', handler, { passive: true });
    linkEl.addEventListener('focus', handler, { passive: true, capture: true });
  }

  function prefetchNextPage(page, artist) {
    if (isSlow) return;
    const url = buildPageUrl(page, artist);
    fetch(url, { credentials: 'omit' })
      .then(r => r.json())
      .then(p => {
        const items = p?.data || [];
        items.forEach(v => v?.cover && prefetchImage(v.cover));
      })
      .catch(() => { /* ignore */ });
  }

  function resetListState() {
    currentPage = 1;
    hasMore = true;
    loading = false;

    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';

    const grid = document.getElementById('vinyl-grid');
    if (grid) grid.innerHTML = '';

    if (!__facetsLoaded) __artistSet.clear();
  }

  function buildCardEl(v) {
    // NOTE: No HTML injection; we use textContent everywhere.
    const col = document.createElement('div');
    col.className = 'col-md-4';

    const a = document.createElement('a');
    a.href = '#/' + encodeURIComponent(v.slug);
    a.className = 'text-decoration-none text-dark card-link';

    const card = document.createElement('div');
    card.className = 'card h-100 shadow-sm vinyl-card gallery-item hidden-until-loaded';

    const img = document.createElement('img');
    img.className = 'card-img-top';
    img.loading = 'lazy';
    img.fetchPriority = 'low';
    img.src = 'data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjEwIiB3aWR0aD0iMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIvPg==';
    img.dataset.src = v.cover || PLACEHOLDER_COVER;
    img.alt = v.title || '';

    const body = document.createElement('div');
    body.className = 'card-body';

    const h5 = document.createElement('h5');
    h5.className = 'card-title';
    h5.textContent = v.title || '';

    const p = document.createElement('p');
    p.className = 'card-text';
    p.textContent = `${v.artist || 'Unknown'}${v.year ? ` (${v.year})` : ''}`;

    body.appendChild(h5);
    body.appendChild(p);

    card.appendChild(img);
    card.appendChild(body);

    a.appendChild(card);
    col.appendChild(a);

    return { col, link: a, card };
  }

  function loadMore() {
    if (loading || !hasMore) return;
    loading = true;

    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'block';

    const url = buildPageUrl(currentPage, activeArtist);

    fetch(url, { credentials: 'omit' })
      .then(r => r.json())
      .then(payload => {
        const list = payload?.data || [];
        const facets = payload?.facets;
        const pg = payload?.pagination;

        if (currentPage === 1) {
          if (facets?.artists?.length) {
            __facetsLoaded = true;
            renderArtistTags(facets);
          } else {
            updateArtistTagsFromBatch(list);
          }
        } else {
          updateArtistTagsFromBatch(list);
        }

        const grid = document.getElementById('vinyl-grid');
        if (!grid) return;

        if (list.length === 0) {
          hasMore = false;
          detachScroll();
          if (currentPage === 1) {
            grid.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'col-12';
            wrap.innerHTML = '<div class="alert alert-warning">No results for the selected filter.</div>';
            grid.appendChild(wrap);
          }
          return;
        }

        const added = [];
        for (const v of list) {
          const { col, link, card } = buildCardEl(v);
          grid.appendChild(col);
          addCardPrefetchHandlers(link, v);
          if (io) io.observe(card);
          added.push(col);
        }

        if (!jsonLdInjected && currentPage === 1) injectListJsonLd(list, 0);

        return hydrateImages(grid).then(() => {
          if (pg) {
            hasMore = !!pg.has_more;
          } else {
            hasMore = list.length === PER_PAGE;
          }

          if (hasMore) {
            prefetchNextPage(currentPage + 1, activeArtist);
            currentPage += 1;
          } else {
            detachScroll();
          }
        });
      })
      .catch(err => {
        console.error('Failed to load page:', err);
        const grid = document.getElementById('vinyl-grid');
        if (grid && currentPage === 1) {
          grid.innerHTML = '';
          const wrap = document.createElement('div');
          wrap.className = 'col-12';
          wrap.innerHTML = '<div class="alert alert-danger">Failed to load vinyls.</div>';
          grid.appendChild(wrap);
        }
        hasMore = false;
        detachScroll();
      })
      .finally(() => {
        loading = false;
        if (loadingEl) loadingEl.style.display = 'none';
      });
  }

  // ---- Grade helpers (used by router) ----
  const GRADE_MAP = new Map([
    [1, { short: 'P', cls: 'grade-poor' }],
    [2, { short: 'G', cls: 'grade-good' }],
    [2.5, { short: 'G+', cls: 'grade-gplus' }],
    [3, { short: 'VG', cls: 'grade-vg' }],
    [3.5, { short: 'VG+', cls: 'grade-vgplus' }],
    [4, { short: 'NM', cls: 'grade-nm' }],
    [5, { short: 'M', cls: 'grade-m' }],
  ]);

  function normalizeScore(score) {
    if (score == null) return null;
    if (typeof score === 'string' && score.trim() === '') return null;

    const n = Number(score);
    if (!Number.isFinite(n) || n <= 0) return null;

    for (const k of GRADE_MAP.keys()) {
      if (Math.abs(n - k) < 0.001) return k;
    }
    return n;
  }

  function getGradeInfo(score) {
    const key = normalizeScore(score);
    if (key == null) return null;

    if (GRADE_MAP.has(key)) return GRADE_MAP.get(key);

    let nearest = null, best = Infinity;
    for (const k of GRADE_MAP.keys()) {
      const d = Math.abs(key - k);
      if (d < best) { best = d; nearest = k; }
    }
    return nearest != null ? GRADE_MAP.get(nearest) : null;
  }

  function renderNotes(detail) {
    // Render personal notes directly into the <p id="d-notes"> element.
    const el = document.getElementById('d-notes');
    if (!el) return;

    const txt = (typeof detail?.notes === 'string') ? detail.notes.trim() : '';
    if (txt) {
      el.textContent = txt;
      el.classList.remove('d-none');
    } else {
      el.textContent = '';
      el.classList.add('d-none');
    }
  }

  window.__getGradeInfo = getGradeInfo;
  window.__renderNotes = renderNotes;

  // Public API for router
  window.__vinylsClearFilter = function () {
    activeArtist = null;
    document.querySelectorAll('[data-artist]').forEach(b => b.classList.remove('active'));
    resetListState();
    attachScroll();
    loadMore();
  };

  window.__vinylsSetFilter = function (artist) {
    activeArtist = artist || null;
    document.querySelectorAll('[data-artist]').forEach(b => {
      const a = b.getAttribute('data-artist');
      if (a === artist) b.classList.add('active'); else b.classList.remove('active');
    });
    resetListState();
    attachScroll();
    loadMore();
  };

  window.__vinylsClearFilterSoft = function () {
    activeArtist = null;
    document.querySelectorAll('[data-artist]').forEach(b => b.classList.remove('active'));
  };

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    const collapseEl = document.getElementById('vinyl-tags');
    if (collapseEl && window.bootstrap?.Collapse) {
      const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
      bsCollapse.hide();
    }

    fetchAndRenderFacets();
    attachScroll();
    loadMore();

    document.addEventListener('click', e => {
      if (!(e.target instanceof Element)) return;

      if (e.target.matches('[data-artist]')) {
        const detailVisible = !document.getElementById('vinyl-detail')?.classList.contains('d-none');
        if (detailVisible) return;

        const artist = e.target.getAttribute('data-artist');
        if (artist === activeArtist) window.__vinylsClearFilter();
        else window.__vinylsSetFilter(artist);
      }

      if (e.target.id === 'toggle-tags-btn' && collapseEl && window.bootstrap?.Collapse) {
        bootstrap.Collapse.getOrCreateInstance(collapseEl).toggle();
      }

      if (e.target.id === 'close-tags-btn' && collapseEl && window.bootstrap?.Collapse) {
        window.__vinylsClearFilter();
        bootstrap.Collapse.getOrCreateInstance(collapseEl).hide();
      }
    });
  });
})();
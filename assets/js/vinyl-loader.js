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

  const __artistSet = new Set();
  let __facetsLoaded = false;

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

  // SEO: emit ItemList only on first page
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
      u.searchParams.set('per_page', '1');
      u.searchParams.set('facets', '1');
      const r = await fetch(u.toString(), { credentials: 'omit' });
      const p = await r.json();
      const artists = p?.facets?.artists;
      if (Array.isArray(artists) && artists.length) {
        __facetsLoaded = true;
        renderArtistTags({ artists });
      }
    } catch {
      // ignore; fallback will fill as pages arrive
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

  function buildPageUrl(page, artist) {
    const u = new URL(API_LIST, location.origin);
    u.searchParams.set('page', String(page));
    u.searchParams.set('per_page', String(PER_PAGE));
    if (artist) u.searchParams.set('artist', artist);
    return u.toString();
  }

  // Hydrate images
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

    // 1) Card title: Title + (Year) moved next to title
    const h5 = document.createElement('h5');
    h5.className = 'card-title';
    h5.textContent = v.title || '';

    if (v.year) {
      const y = document.createElement('span');
      y.className = 'ms-2 text-muted';
      y.style.fontSize = '0.85em';
      y.textContent = `(${v.year})`;
      h5.appendChild(y);
    }

    // Subtitle: artist only
    const p = document.createElement('p');
    p.className = 'card-text';
    p.textContent = (v.artist || 'Unknown');

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

        for (const v of list) {
          const { col } = buildCardEl(v);
          grid.appendChild(col);
        }

        if (!jsonLdInjected && currentPage === 1) injectListJsonLd(list, 0);

        return hydrateImages(grid).then(() => {
          if (pg) {
            hasMore = !!pg.has_more;
          } else {
            hasMore = list.length === PER_PAGE;
          }

          if (hasMore) {
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

  // ---- Detail helpers (notes + tracklist under notes) ----
  function ensureTracklistContainer() {
    // Ensure a container exists under #d-notes
    const notes = document.getElementById('d-notes');
    if (!notes) return null;

    let t = document.getElementById('d-tracklist');
    if (!t) {
      t = document.createElement('div');
      t.id = 'd-tracklist';
      t.className = 'mt-3 d-none';
      notes.insertAdjacentElement('afterend', t);
    }
    return t;
  }

  function sideFromPos(pos) {
    // A1, B2, C3... => 'A', 'B', 'C'
    if (!pos || typeof pos !== 'string') return '';
    const m = pos.trim().match(/^([A-Z]+)/i);
    return m ? m[1].toUpperCase() : '';
  }

  function renderTracklist(detail) {
    const t = ensureTracklistContainer();
    if (!t) return;

    const tracks = Array.isArray(detail?.tracks) ? detail.tracks : [];
    t.innerHTML = '';

    if (!tracks.length) {
      t.classList.add('d-none');
      return;
    }

    let prevSide = '';
    for (let i = 0; i < tracks.length; i++) {
      const tr = tracks[i] || {};
      const pos = (typeof tr.pos === 'string') ? tr.pos.trim() : '';
      const title = (typeof tr.title === 'string') ? tr.title.trim() : '';
      const duration = (typeof tr.duration === 'string') ? tr.duration.trim() : '';

      if (!title && !pos) continue;

      const side = sideFromPos(pos);
      if (prevSide && side && side !== prevSide) {
        const gap = document.createElement('div');
        gap.className = 'track-gap';
        t.appendChild(gap);
      }
      if (side) prevSide = side;

      const row = document.createElement('div');
      row.className = 'track-row';

      const left = document.createElement('div');
      left.className = 'track-left';

      const titleEl = document.createElement('span');
      titleEl.className = 'track-title';
      titleEl.textContent = title || 'Untitled';

      left.appendChild(titleEl);

      if (duration) {
        const dur = document.createElement('span');
        dur.className = 'ms-2 text-muted';
        dur.style.fontSize = '0.85em';
        dur.textContent = duration;
        left.appendChild(dur);
      }

      const dots = document.createElement('div');
      dots.className = 'track-dots';

      const right = document.createElement('div');
      right.className = 'track-pos';
      right.textContent = pos;

      row.appendChild(left);
      row.appendChild(dots);
      row.appendChild(right);

      t.appendChild(row);
    }

    t.classList.remove('d-none');
  }

  function renderNotes(detail) {
    // Notes into #d-notes, then tracklist under it.
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

    renderTracklist(detail);
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
// assets/js/vinyl-loader.js
(function () {
  // ---- Guards ----
  if (!window.__VINYLS_API__ || !window.__VINYLS_API__.trim()) {
    console.error('VINYLS: Missing window.__VINYLS_API__ (set site.vinyls_api_url in _config.yml)');
  }
  if (!window.__SITE_BASE__ || !window.__SITE_BASE__.trim()) {
    console.error('VINYLS: Missing window.__SITE_BASE__ (site.url+baseurl)');
  }

  const API_LIST = window.__VINYLS_API__.trim().replace(/\/+$/, '');
  const SITE_BASE = window.__SITE_BASE__.trim().replace(/\/+$/, '');
  const VINYLS_ABS = SITE_BASE + '/vinyls';
  const PER_PAGE = Number.isFinite(+window.__VINYLS_PER_PAGE__) ? +window.__VINYLS_PER_PAGE__ : 9;
  const PLACEHOLDER_COVER = 'https://placehold.co/600x600?text=No+cover';

  let currentPage = 1;
  let hasMore = true;
  let loading = false;
  let activeArtist = null;
  let jsonLdInjected = false;
  let __scrollAttached = false;

  // --- NEW: facets/fallback state for artist tags ---
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
    if (!__scrollAttached) { window.addEventListener('scroll', onScroll); __scrollAttached = true; }
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
    tagContainer.innerHTML = artists.map(artist => `
      <button class="btn btn-outline-secondary btn-sm me-2 mb-2" data-artist="${artist}">
        ${artist}
      </button>
    `).join('');
  }

  // --- NEW: try to fetch server-provided facets once (preferred) ---
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

  // --- NEW: fallback – progressively build artist tags from loaded pages ---
  function updateArtistTagsFromBatch(list) {
    if (__facetsLoaded) return; // server facets take precedence
    let changed = false;
    for (const v of list || []) {
      if (v?.artist && !__artistSet.has(v.artist)) {
        __artistSet.add(v.artist);
        changed = true;
      }
    }
    if (changed) {
      renderArtistTags({
        artists: Array.from(__artistSet)
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
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
          resolved = true; clearTimeout(t); resolve();
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

  function addCardPrefetchHandlers(cardEl, vinyl) {
    const detailUrl = `${API_LIST}/${encodeURIComponent(vinyl.slug)}`;
    let scheduled = false;
    const handler = () => {
      if (scheduled) return;
      scheduled = true;
      prefetchJSON(detailUrl);
      if (vinyl.cover) prefetchImage(vinyl.cover);
    };
    cardEl.addEventListener('mouseenter', handler, { passive: true });
    cardEl.addEventListener('touchstart', handler, { passive: true });
    cardEl.addEventListener('focus', handler, { passive: true, capture: true });
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
      .catch(() => { });
  }

  function resetListState() {
    currentPage = 1;
    hasMore = true;
    loading = false;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('vinyl-grid').innerHTML = '';
    // NEW: when we change filters, if facets weren't provided by server, clear the fallback set
    if (!__facetsLoaded) __artistSet.clear();
  }

  function loadMore() {
    if (loading || !hasMore) return;
    loading = true;
    const loadingEl = document.getElementById('loading');
    loadingEl.style.display = 'block';

    const url = buildPageUrl(currentPage, activeArtist);
    fetch(url, { credentials: 'omit' })
      .then(r => r.json())
      .then(payload => {
        const list = payload?.data || [];
        const facets = payload?.facets;
        const pg = payload?.pagination;

        // NEW: first page → prefer server facets; otherwise start progressive fallback
        if (currentPage === 1) {
          if (facets?.artists?.length) {
            __facetsLoaded = true;
            renderArtistTags(facets);
          } else {
            updateArtistTagsFromBatch(list);
          }
        } else {
          // subsequent pages → only update in fallback mode
          updateArtistTagsFromBatch(list);
        }

        if (list.length === 0) {
          hasMore = false;
          detachScroll();
          if (currentPage === 1) {
            document.getElementById('vinyl-grid').innerHTML =
              `<div class="col-12"><div class="alert alert-warning">No results for the selected filter.</div></div>`;
          }
          return;
        }

        const container = document.getElementById('vinyl-grid');
        const temp = document.createElement('div');
        const spacer = 'data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjEwIiB3aWR0aD0iMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIvPg==';

        temp.innerHTML = list.map(v => {
          const href = '#/' + encodeURIComponent(v.slug);
          const cover = v.cover || PLACEHOLDER_COVER;
          const safeTitle = (v.title || '').replace(/"/g, '&quot;');
          return `
            <div class="col-md-4">
              <a href="${href}" class="text-decoration-none text-dark card-link">
                <div class="card h-100 shadow-sm vinyl-card gallery-item hidden-until-loaded">
                  <img src="${spacer}" data-src="${cover}" class="card-img-top" alt="${safeTitle}" loading="lazy"
                       fetchpriority="low"
                       onerror="this.onerror=null;this.src='${PLACEHOLDER_COVER}';">
                  <div class="card-body">
                    <h5 class="card-title">${safeTitle}</h5>
                    <p class="card-text">${v.artist || 'Unknown'}${v.year ? ` (${v.year})` : ''}</p>
                  </div>
                </div>
              </a>
            </div>`;
        }).join('');

        const newEls = [...temp.children];
        newEls.forEach((el, idx) => {
          container.appendChild(el);
          const link = el.querySelector('.card-link');
          addCardPrefetchHandlers(link, list[idx]);
          if (io) io.observe(el.querySelector('.vinyl-card'));
        });

        if (!jsonLdInjected && currentPage === 1) injectListJsonLd(list, 0);

        return hydrateImages(container).then(() => {
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
        if (currentPage === 1) {
          document.getElementById('vinyl-grid').innerHTML =
            `<div class="col-12"><div class="alert alert-danger">Failed to load vinyls.</div></div>`;
        }
        hasMore = false;
        detachScroll();
      })
      .finally(() => {
        loading = false;
        loadingEl.style.display = 'none';
      });
  }

  // --- NEW: Grade mapping & rendering helpers (for detail view) ---
  // These helpers map numeric rating from API to human-readable label and CSS class,
  // and render both the grade "stamp" and optional personal notes.
  const GRADE_MAP = new Map([
    [1, { short: 'P', label: 'Poor', cls: 'grade-poor' }],
    [2, { short: 'G', label: 'Good', cls: 'grade-good' }],
    [2.5, { short: 'G+', label: 'Good Plus', cls: 'grade-gplus' }],
    [3, { short: 'VG', label: 'Very Good', cls: 'grade-vg' }],
    [3.5, { short: 'VG+', label: 'Very Good+', cls: 'grade-vgplus' }],
    [4, { short: 'NM', label: 'Near Mint', cls: 'grade-nm' }],
    [5, { short: 'M', label: 'Mint', cls: 'grade-m' }],
  ]);

  function normalizeScore(score) {
    // Accept strings or numbers. Snap to known floating keys when close (e.g., 2.5).
    const n = Number(score);
    if (!Number.isFinite(n)) return null;
    for (const k of GRADE_MAP.keys()) {
      if (Math.abs(n - k) < 0.001) return k;
    }
    return n;
  }

  function getGradeInfo(score) {
    const key = normalizeScore(score);
    if (key != null && GRADE_MAP.has(key)) return GRADE_MAP.get(key);
    // Fallback: nearest known value
    let nearest = null, best = Infinity;
    for (const k of GRADE_MAP.keys()) {
      const d = Math.abs((key ?? 0) - k);
      if (d < best) { best = d; nearest = k; }
    }
    return nearest != null ? GRADE_MAP.get(nearest) : null;
  }

  function renderGradeAndNotes(detail) {
    // Expected fields from API:
    // - detail.rating: Number like 1, 2, 2.5, 3, 3.5, 4, 5
    // - detail.notes:  String (optional)
    const ratingWrap = document.getElementById('d-rating');
    const gradeEl = document.getElementById('d-grade');
    const notesWrap = document.getElementById('d-notes');

    // Grade rendering
    if (detail && detail.rating != null) {
      const info = getGradeInfo(detail.rating);
      if (info) {
        if (gradeEl) {
          gradeEl.textContent = info.short + ' — ' + info.label;
          gradeEl.className = 'grade-badge ' + info.cls;
        }
        if (ratingWrap) ratingWrap.classList.remove('d-none');
      } else {
        if (ratingWrap) ratingWrap.classList.add('d-none');
      }
    } else {
      if (ratingWrap) ratingWrap.classList.add('d-none');
    }

    // Notes rendering
    if (detail && typeof detail.notes === 'string' && detail.notes.trim().length) {
      const p = notesWrap ? notesWrap.querySelector('p') : null;
      if (p) p.textContent = detail.notes.trim();
      if (notesWrap) notesWrap.classList.remove('d-none');
    } else {
      if (notesWrap) notesWrap.classList.add('d-none');
    }
  }

  // Expose the renderer so your detail-view code can call it after fetching one record.
  window.__renderGradeAndNotes = renderGradeAndNotes;

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
    const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
    bsCollapse.hide();
    fetchAndRenderFacets();
    attachScroll();
    loadMore();

    document.addEventListener('click', e => {
      if (e.target.matches('[data-artist]')) {
        const detailVisible = !document.getElementById('vinyl-detail').classList.contains('d-none');
        if (detailVisible) return;
        const artist = e.target.getAttribute('data-artist');
        if (artist === activeArtist) window.__vinylsClearFilter();
        else window.__vinylsSetFilter(artist);
      }
      if (e.target.id === 'toggle-tags-btn') {
        bootstrap.Collapse.getOrCreateInstance(collapseEl).toggle();
      }
      if (e.target.id === 'close-tags-btn') {
        window.__vinylsClearFilter();
        bootstrap.Collapse.getOrCreateInstance(collapseEl).hide();
      }
    });
  });
})();
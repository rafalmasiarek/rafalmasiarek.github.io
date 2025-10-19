// assets/js/vinyl-loader.js
(function () {
  // ---- Guards ----
  if (!window.__VINYLS_API__ || !window.__VINYLS_API__.trim()) {
    console.error('VINYLS: Missing window.__VINYLS_API__ (set site.vinyls_api_url in _config.yml)');
  }
  if (!window.__SITE_BASE__ || !window.__SITE_BASE__.trim()) {
    console.error('VINYLS: Missing window.__SITE_BASE__ (site.url+baseurl)');
  }

  // ---- Config ----
  const API_LIST = window.__VINYLS_API__.trim().replace(/\/+$/, '');
  const SITE_BASE = window.__SITE_BASE__.trim().replace(/\/+$/, '');
  const VINYLS_ABS = SITE_BASE + '/vinyls';

  // ---- State ----
  window.allVinyls = window.allVinyls || [];
  let filteredVinyls = [];
  let page = 0;
  const pageSize = 9;
  let loading = false;
  let activeArtist = null;
  let jsonLdInjected = false;

  // ---- Scroll listener management ----
  let __scrollAttached = false;
  function onScroll() {
    const nearBottom = window.scrollY + window.innerHeight >= document.body.offsetHeight - 100;
    if (!loading && nearBottom) loadMore();
  }
  function attachScroll() {
    if (!__scrollAttached) {
      window.addEventListener('scroll', onScroll);
      __scrollAttached = true;
    }
  }
  function detachScroll() {
    if (__scrollAttached) {
      window.removeEventListener('scroll', onScroll);
      __scrollAttached = false;
    }
  }
  // expose for router
  window.attachScroll = attachScroll;
  window.detachScroll = detachScroll;

  // ---- SEO: ItemList JSON-LD ----
  function injectListJsonLd(items) {
    if (jsonLdInjected || !Array.isArray(items) || !items.length) return;
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-jsonld', 'itemlist');
    s.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: items.map((v, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${VINYLS_ABS}/#/${encodeURIComponent(v.slug)}`
      }))
    });
    document.head.appendChild(s);
    jsonLdInjected = true;
  }

  // ---- Lazy images with timeout fallback ----
  function lazyLoadVinyls(container, threshold = 0.5) {
    const images = container.querySelectorAll('img[data-src]');
    const total = images.length;
    let loaded = 0, resolved = false;

    return new Promise((resolve) => {
      if (total === 0) return resolve();

      const t = setTimeout(() => {
        if (!resolved) { resolved = true; resolve(); }
      }, 2000);

      function maybeResolve() {
        if (!resolved && loaded / total >= threshold) {
          resolved = true; clearTimeout(t); resolve();
        }
      }

      images.forEach(img => {
        const card = img.closest('.gallery-item');
        const done = () => {
          loaded++;
          img.classList.add('loaded');
          if (card) card.classList.add('visible');
          maybeResolve();
        };
        img.addEventListener('load', done);
        img.addEventListener('error', done);
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    });
  }

  // ---- UI helpers ----
  function renderArtistTags(data) {
    const artists = [...new Set(data.map(v => v.artist))].filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const tagContainer = document.getElementById('artist-buttons');
    tagContainer.innerHTML = artists.map(artist => `
      <button class="btn btn-outline-secondary btn-sm me-2 mb-2" data-artist="${artist}">
        ${artist}
      </button>
    `).join('');
  }

  function rebuildList(fromTop = false) {
    loading = false; // safety
    document.getElementById('loading').style.display = 'none';
    page = 0;
    const grid = document.getElementById('vinyl-grid');
    grid.innerHTML = '';

    if (!filteredVinyls.length) {
      detachScroll();
      grid.innerHTML = `<div class="col-12"><div class="alert alert-warning">No results for the selected filter.</div></div>`;
      if (fromTop) window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    attachScroll();
    if (fromTop) window.scrollTo({ top: 0, behavior: 'instant' });
    loadMore();
  }

  function loadMore() {
    if (loading) return;
    loading = true;
    const loadingEl = document.getElementById('loading');
    loadingEl.style.display = 'block';

    try {
      const start = page * pageSize;
      const end = start + pageSize;
      const items = filteredVinyls.slice(start, end);

      if (items.length === 0) {
        loadingEl.style.display = 'none';
        detachScroll();
        loading = false;
        return;
      }

      const container = document.getElementById('vinyl-grid');
      const temp = document.createElement('div');

      const placeholder = 'data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjEwIiB3aWR0aD0iMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIvPg==';

      temp.innerHTML = items.map(v => {
        const url = '#/' + encodeURIComponent(v.slug);
        const cover = v.cover || 'https://placehold.co/600x600?text=No+cover';
        const safeTitle = (v.title || '').replace(/"/g, '&quot;');
        return `
          <div class="col-md-4">
            <a href="${url}" class="text-decoration-none text-dark">
              <div class="card h-100 shadow-sm vinyl-card gallery-item hidden-until-loaded">
                <img src="${placeholder}" data-src="${cover}" class="card-img-top" alt="${safeTitle}" loading="lazy"
                     onerror="this.onerror=null;this.src='https://placehold.co/600x600?text=No+cover';">
                <div class="card-body">
                  <h5 class="card-title">${safeTitle}</h5>
                  <p class="card-text">${v.artist || 'Unknown'}${v.year ? ` (${v.year})` : ''}</p>
                </div>
              </div>
            </a>
          </div>`;
      }).join('');

      [...temp.children].forEach(el => container.appendChild(el));

      if (!jsonLdInjected) injectListJsonLd(window.allVinyls);

      lazyLoadVinyls(container).then(() => {
        page++;
      }).finally(() => {
        loading = false;
        loadingEl.style.display = 'none';
      });
    } catch (e) {
      console.error(e);
      loading = false;
      document.getElementById('loading').style.display = 'none';
    }
  }

  function applyFilter() {
    filteredVinyls = activeArtist ? window.allVinyls.filter(v => v.artist === activeArtist) : window.allVinyls;
    rebuildList(true);
  }

  // ---- Public API for router ----
  window.__vinylsClearFilter = function () {
    activeArtist = null;
    document.querySelectorAll('[data-artist]').forEach(b => b.classList.remove('active'));
    filteredVinyls = window.allVinyls;
    rebuildList(true);
  };

  window.__vinylsSetFilter = function (artist) {
    activeArtist = artist || null;
    document.querySelectorAll('[data-artist]').forEach(b => {
      const a = b.getAttribute('data-artist');
      if (a === artist) b.classList.add('active'); else b.classList.remove('active');
    });
    filteredVinyls = activeArtist ? window.allVinyls.filter(v => v.artist === activeArtist) : window.allVinyls;
    rebuildList(true);
  };

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    const collapseEl = document.getElementById('vinyl-tags');
    const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
    bsCollapse.hide();

    fetch(API_LIST, { credentials: 'omit' })
      .then(r => r.json())
      .then(p => {
        if (!p || !p.data) throw new Error('Invalid API response');
        window.allVinyls = p.data;
        filteredVinyls = window.allVinyls;
        renderArtistTags(window.allVinyls);
        loadMore();
        attachScroll();
      })
      .catch(err => {
        console.error('Failed to load vinyls:', err);
        document.getElementById('vinyl-grid').innerHTML =
          `<div class="col-12"><div class="alert alert-danger">Failed to load vinyls list.</div></div>`;
        detachScroll();
      });

    document.addEventListener('click', e => {
      // Filter clicks on LIST view (router handles them on DETAIL view)
      if (e.target.matches('[data-artist]')) {
        const detailVisible = !document.getElementById('vinyl-detail').classList.contains('d-none');
        if (detailVisible) return; // handled by router
        const btn = e.target;
        const artist = btn.getAttribute('data-artist');
        if (artist === activeArtist) {
          window.__vinylsClearFilter();
        } else {
          window.__vinylsSetFilter(artist);
        }
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
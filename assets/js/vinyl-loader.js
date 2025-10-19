// assets/js/vinyl-loader.js
// Uses full API endpoint from config: window.__VINYLS_API__ (list) and appends "/{slug}" for detail.
// Builds absolute URLs from window.__SITE_BASE__ for JSON-LD. No domain hardcoding.

(function () {
  // --- Config guards ---
  if (!window.__VINYLS_API__ || !window.__VINYLS_API__.trim()) {
    console.error('VINYLS: Missing window.__VINYLS_API__ (set site.vinyls_api_url in _config.yml)');
  }
  if (!window.__SITE_BASE__ || !window.__SITE_BASE__.trim()) {
    console.error('VINYLS: Missing window.__SITE_BASE__ (site.url+baseurl)');
  }

  // --- Helpers ---
  const API_LIST = window.__VINYLS_API__.trim().replace(/\/+$/, '');   // e.g. https://masiarek.pl/api/v1/vinyls
  const SITE_BASE = window.__SITE_BASE__.trim().replace(/\/+$/, '');   // e.g. https://masiarek.pl
  const VINYLS_ABS = SITE_BASE + '/vinyls';

  function injectListJsonLd(items) {
    if (!Array.isArray(items) || !items.length) return;
    if (document.querySelector('script[data-jsonld="itemlist"]')) return;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-jsonld', 'itemlist');

    const payload = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: items.map((v, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${VINYLS_ABS}/#/${encodeURIComponent(v.slug)}`
      }))
    };

    script.textContent = JSON.stringify(payload);
    document.head.appendChild(script);
  }

  // --- State ---
  window.allVinyls = window.allVinyls || [];
  let filteredVinyls = [];
  let page = 0;
  const pageSize = 9;
  let loading = false;
  let activeArtist = null;

  // --- Lazy image fade-in ---
  function lazyLoadVinyls(container, threshold = 0.8) {
    const images = container.querySelectorAll('img[data-src]');
    const total = images.length;
    let loaded = 0, resolved = false;

    return new Promise((resolve) => {
      if (total === 0) return resolve();
      images.forEach(img => {
        const card = img.closest('.gallery-item');
        const done = () => {
          loaded++;
          if (!resolved && loaded / total >= threshold) { resolved = true; resolve(); }
          img.classList.add('loaded');
          if (card) card.classList.add('visible');
        };
        img.addEventListener('load', done);
        img.addEventListener('error', done);
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    });
  }

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

  function loadMore() {
    if (loading) return;
    loading = true;
    document.getElementById('loading').style.display = 'block';

    const start = page * pageSize;
    const end = start + pageSize;
    const items = filteredVinyls.slice(start, end);

    if (items.length === 0) {
      document.getElementById('loading').style.display = 'none';
      window.removeEventListener('scroll', onScroll);
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

    // Inject JSON-LD once (full list)
    if (!document.querySelector('script[data-jsonld="itemlist"]')) injectListJsonLd(window.allVinyls);

    lazyLoadVinyls(container).then(() => {
      page++;
      loading = false;
      document.getElementById('loading').style.display = 'none';
    });
  }

  function onScroll() {
    const nearBottom = window.scrollY + window.innerHeight >= document.body.offsetHeight - 100;
    if (!loading && nearBottom) loadMore();
  }

  function applyFilter() {
    filteredVinyls = activeArtist ? window.allVinyls.filter(v => v.artist === activeArtist) : window.allVinyls;
    page = 0;
    document.getElementById('vinyl-grid').innerHTML = '';
    loadMore();
  }

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
        window.addEventListener('scroll', onScroll);
      })
      .catch(err => {
        console.error('Failed to load vinyls:', err);
        document.getElementById('vinyl-grid').innerHTML =
          `<div class="col-12"><div class="alert alert-danger">Failed to load vinyls list.</div></div>`;
      });

    document.addEventListener('click', e => {
      if (e.target.matches('[data-artist]')) {
        const btn = e.target;
        const artist = btn.getAttribute('data-artist');
        if (artist === activeArtist) {
          activeArtist = null;
          document.querySelectorAll('[data-artist]').forEach(b => b.classList.remove('active'));
        } else {
          activeArtist = artist;
          document.querySelectorAll('[data-artist]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
        applyFilter();
      }
      if (e.target.id === 'toggle-tags-btn') {
        bootstrap.Collapse.getOrCreateInstance(collapseEl).toggle();
      }
      if (e.target.id === 'close-tags-btn') {
        activeArtist = null;
        document.querySelectorAll('[data-artist]').forEach(b => b.classList.remove('active'));
        bootstrap.Collapse.getOrCreateInstance(collapseEl).hide();
        applyFilter();
      }
    });
  });
})();

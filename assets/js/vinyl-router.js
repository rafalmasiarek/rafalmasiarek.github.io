// assets/js/vinyl-router.js
// Pure hash routing (#/slug) + SEO signals (title, description, JSON-LD).
// Domain-agnostic: derives absolute URLs from SITE_BASE (Jekyll) or location.origin.

(function () {
  // --------- URL helpers ----------
  function normSlash(s) { return s.replace(/\/+$/, ''); }
  function ensureAbs(base, path) {
    base = normSlash(base || '');
    if (!path) return base;
    return base + (path.startsWith('/') ? path : '/' + path);
  }

  const RUNTIME_ORIGIN = location.origin;
  const SITE_BASE = (window.__SITE_BASE__ && window.__SITE_BASE__.trim())
    ? window.__SITE_BASE__.trim()
    : RUNTIME_ORIGIN;

  const apiHint = (window.__API_BASE_HINT__ || (document.querySelector('meta[name="x-api-base"]')?.content) || '').trim();
  const API_BASE = apiHint
    ? (apiHint.startsWith('http') ? normSlash(apiHint) : ensureAbs(RUNTIME_ORIGIN, apiHint))
    : ensureAbs(RUNTIME_ORIGIN, '/api/v1');

  const VINYLS_BASE_ABS = ensureAbs(SITE_BASE, '/vinyls');

  // ----- Routing helpers (HASH ONLY) -----
  function readSlugFromHash() {
    // Accept "#/slug" or "#slug"
    return (location.hash || '').replace(/^#\/?/, '') || null;
  }

  // ----- Head/meta helpers -----
  function setListHead() {
    document.title = `My Vinyl Collection – ${document.querySelector('header .username a')?.textContent || ''}`;
    const meta = document.getElementById('meta-desc');
    if (meta) meta.setAttribute('content', 'Browse my vinyl record collection.');
    // Canonical remains at /vinyls/ (hash ignored by crawlers)
    const canonical = document.getElementById('canonical-link');
    if (canonical) canonical.href = `${VINYLS_BASE_ABS}/`;
    // Remove album/breadcrumbs JSON-LD if present
    [...document.querySelectorAll('script[data-jsonld]')].forEach(n => n.remove());
  }

  function setDetailHead(v) {
    const siteName = document.querySelector('header .username a')?.textContent || 'Vinyls';
    const title = v.title || 'Untitled';
    const artist = v.artist || 'Unknown';
    document.title = `${title} – ${artist} | ${siteName}`;

    const desc = `${title} by ${artist}${v.year ? `, released ${v.year}` : ''}. View details from my vinyl collection.`;
    const meta = document.getElementById('meta-desc');
    if (meta) meta.setAttribute('content', desc);

    // Canonical stays at the list
    const canonical = document.getElementById('canonical-link');
    if (canonical) canonical.href = `${VINYLS_BASE_ABS}/`;

    injectAlbumJsonLd(v);
    injectBreadcrumbsJsonLd(v);
  }

  // ----- JSON-LD helpers -----
  function injectAlbumJsonLd(v) {
    // Clear previous
    [...document.querySelectorAll('script[data-jsonld="album"]')].forEach(n => n.remove());

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-jsonld', 'album');

    const payload = {
      '@context': 'https://schema.org',
      '@type': 'MusicAlbum',
      name: v.title || 'Untitled',
      byArtist: v.artist ? { '@type': 'MusicGroup', name: v.artist } : undefined,
      image: v.cover || undefined,
      datePublished: v.year ? String(v.year) : undefined,
      url: `${VINYLS_BASE_ABS}/#/${encodeURIComponent(v.slug)}`
    };

    script.textContent = JSON.stringify(payload);
    document.head.appendChild(script);
  }

  function injectBreadcrumbsJsonLd(v) {
    // Clear previous
    [...document.querySelectorAll('script[data-jsonld="breadcrumbs"]')].forEach(n => n.remove());

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-jsonld', 'breadcrumbs');

    const payload = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home',   item: ensureAbs(SITE_BASE, '/') },
        { '@type': 'ListItem', position: 2, name: 'Vinyls', item: `${VINYLS_BASE_ABS}/` },
        { '@type': 'ListItem', position: 3, name: v.title || 'Record', item: `${VINYLS_BASE_ABS}/#/${encodeURIComponent(v.slug)}` }
      ]
    };

    script.textContent = JSON.stringify(payload);
    document.head.appendChild(script);
  }

  // ----- Data helpers -----
  async function fetchVinylBySlug(slug) {
    try {
      const r = await fetch(`${API_BASE}/vinyls/${encodeURIComponent(slug)}`, { credentials: 'omit' });
      if (r.ok) {
        const p = await r.json();
        if (p && p.data) return p.data;
      }
    } catch {}
    if (Array.isArray(window.allVinyls) && window.allVinyls.length) {
      return window.allVinyls.find(v => v.slug === slug);
    }
    const r2 = await fetch(`${API_BASE}/vinyls`, { credentials: 'omit' });
    const p2 = await r2.json();
    const list = (p2 && p2.data) || [];
    return list.find(v => v.slug === slug);
  }

  // ----- UI render -----
  function showListPanel() {
    document.getElementById('vinyl-detail').classList.add('d-none');
    document.getElementById('list-panel').classList.remove('d-none');
    document.getElementById('vinyl-tags').classList.remove('d-none');
    document.getElementById('toggle-tags-btn').classList.remove('d-none');
    setListHead();
  }

  async function showDetailPanel(slug) {
    document.getElementById('vinyl-detail').classList.remove('d-none');
    document.getElementById('list-panel').classList.add('d-none');
    document.getElementById('vinyl-tags').classList.add('d-none');
    document.getElementById('toggle-tags-btn').classList.add('d-none');

    const v = await fetchVinylBySlug(slug);
    if (!v) {
      document.getElementById('vinyl-detail').innerHTML =
        `<div class="alert alert-danger">Vinyl not found.</div>`;
      return;
    }

    // Render details
    const title = v.title || 'Untitled';
    const artist = v.artist || 'Unknown';
    const yearText = v.year ? ` (${v.year})` : '';

    const img = document.getElementById('d-cover');
    img.alt = title;
    img.src = v.cover || 'https://placehold.co/600x600?text=No+cover';

    document.getElementById('d-title').textContent = title;
    document.getElementById('d-subtitle').textContent = `${artist}${yearText}`;

    const r = document.getElementById('d-rating');
    if (typeof v.rating === 'number') {
      r.innerHTML = renderStars(v.rating);
      r.classList.remove('d-none');
    } else {
      r.classList.add('d-none');
    }

    const rev = document.getElementById('d-review');
    if (v.review) { rev.querySelector('p').textContent = v.review; rev.classList.remove('d-none'); }
    else { rev.classList.add('d-none'); }

    const desc = document.getElementById('d-description');
    if (v.description) { desc.textContent = v.description; desc.classList.remove('d-none'); }
    else { desc.classList.add('d-none'); }

    // Update head/meta + JSON-LD
    setDetailHead(v);

    // Normalize hash to "#/slug"
    const want = '#/' + encodeURIComponent(slug);
    if (location.hash !== want) history.replaceState(null, '', want);

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function renderStars(n) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= n ? '★ ' : '☆ ';
    return `<strong>Rating:</strong> <span class="text-warning">${s}</span>`;
  }

  // ----- Router -----
  function onRouteChange() {
    const slug = readSlugFromHash();
    if (slug) showDetailPanel(slug);
    else showListPanel();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Back button → clear hash (go to list)
    document.getElementById('back-to-list')?.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, '', `${VINYLS_BASE_ABS}/`); // clears hash, respects baseurl
      onRouteChange();
    });

    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);

    // Initial route
    onRouteChange();
  });
})();

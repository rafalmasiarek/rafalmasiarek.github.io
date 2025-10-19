// assets/js/vinyl-router.js
(function () {
  if (!window.__VINYLS_API__ || !window.__VINYLS_API__.trim()) {
    console.error('VINYLS: Missing window.__VINYLS_API__');
  }
  if (!window.__SITE_BASE__ || !window.__SITE_BASE__.trim()) {
    console.error('VINYLS: Missing window.__SITE_BASE__');
  }

  const API_LIST = window.__VINYLS_API__.trim().replace(/\/+$/, '');
  const SITE_BASE = window.__SITE_BASE__.trim().replace(/\/+$/, '');
  const VINYLS_ABS = SITE_BASE + '/vinyls';

  function slugFromHash() {
    return (location.hash || '').replace(/^#\/?/, '') || null;
  }

  // ---- Head/meta & JSON-LD ----
  function setListHead() {
    document.title = `My Vinyl Collection – ${document.querySelector('header .username a')?.textContent || ''}`;
    const meta = document.getElementById('meta-desc');
    if (meta) meta.setAttribute('content', 'Browse my vinyl record collection.');
    const canonical = document.getElementById('canonical-link');
    if (canonical) canonical.href = `${VINYLS_ABS}/`;
    [...document.querySelectorAll('script[data-jsonld="album"],script[data-jsonld="breadcrumbs"]')].forEach(n => n.remove());
  }

  function setDetailHead(v) {
    const siteName = document.querySelector('header .username a')?.textContent || 'Vinyls';
    const title = v.title || 'Untitled';
    const artist = v.artist || 'Unknown';
    document.title = `${title} – ${artist} | ${siteName}`;

    const desc = `${title} by ${artist}${v.year ? `, released ${v.year}` : ''}. View details from my vinyl collection.`;
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
      name: v.title || 'Untitled',
      byArtist: v.artist ? { '@type': 'MusicGroup', name: v.artist } : undefined,
      image: v.cover || undefined,
      datePublished: v.year ? String(v.year) : undefined,
      url: `${VINYLS_ABS}/#/${encodeURIComponent(v.slug)}`
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
        { '@type': 'ListItem', position: 3, name: v.title || 'Record', item: `${VINYLS_ABS}/#/${encodeURIComponent(v.slug)}` }
      ]
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
    } catch { }
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
    document.getElementById('vinyl-detail').classList.add('d-none');
    document.getElementById('list-panel').classList.remove('d-none');
    document.getElementById('vinyl-tags').classList.remove('d-none');
    document.getElementById('toggle-tags-btn').classList.remove('d-none');
    setListHead();
    if (window.attachScroll) window.attachScroll();
  }

  async function showDetail(slug) {
    // Requirement: entering record resets filter
    if (window.__vinylsClearFilter) window.__vinylsClearFilter();
    if (window.detachScroll) window.detachScroll();

    document.getElementById('vinyl-detail').classList.remove('d-none');
    document.getElementById('list-panel').classList.add('d-none');
    document.getElementById('vinyl-tags').classList.add('d-none');
    document.getElementById('toggle-tags-btn').classList.add('d-none');

    const v = await fetchBySlug(slug);
    if (!v) {
      document.getElementById('vinyl-detail').innerHTML = `<div class="alert alert-danger">Vinyl not found.</div>`;
      return;
    }

    const title = v.title || 'Untitled';
    const artist = v.artist || 'Unknown';
    const yearText = v.year ? ` (${v.year})` : '';

    const img = document.getElementById('d-cover');
    img.alt = title;
    img.src = v.cover || 'https://placehold.co/600x600?text=No+cover';

    document.getElementById('d-title').textContent = title;
    document.getElementById('d-subtitle').textContent = `${artist}${yearText}`;

    const r = document.getElementById('d-rating');
    if (typeof v.rating === 'number') { r.innerHTML = renderStars(v.rating); r.classList.remove('d-none'); }
    else { r.classList.add('d-none'); }

    const rev = document.getElementById('d-review');
    if (v.review) { rev.querySelector('p').textContent = v.review; rev.classList.remove('d-none'); }
    else { rev.classList.add('d-none'); }

    const desc = document.getElementById('d-description');
    if (v.description) { desc.textContent = v.description; desc.classList.remove('d-none'); }
    else { desc.classList.add('d-none'); }

    setDetailHead(v);

    const want = '#/' + encodeURIComponent(slug);
    if (location.hash !== want) history.replaceState(null, '', want);

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function renderStars(n) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= n ? '★ ' : '☆ ';
    return `<strong>Rating:</strong> <span class="text-warning">${s}</span>`;
  }

  // ---- Router ----
  function route() {
    const slug = slugFromHash();
    if (slug) showDetail(slug);
    else showList();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Back to list
    document.getElementById('back-to-list')?.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, '', `${VINYLS_ABS}/`);
      route();
    });

    // Clicking a filter while in DETAIL -> go to list URL and enable that filter
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-artist]')) {
        const detailVisible = !document.getElementById('vinyl-detail').classList.contains('d-none');
        if (detailVisible) {
          e.preventDefault();
          const artist = e.target.getAttribute('data-artist');
          history.pushState(null, '', `${VINYLS_ABS}/`); // back to list
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
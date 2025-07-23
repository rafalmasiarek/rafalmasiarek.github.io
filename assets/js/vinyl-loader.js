let allVinyls = [];
let filteredVinyls = [];
let page = 0;
const pageSize = 9;
let loading = false;
let activeArtist = null;

// Fade-in image tiles after lazy load threshold is met
function lazyLoadVinyls(container, threshold = 0.8) {
  const images = container.querySelectorAll('img[data-src]');
  const total = images.length;
  let loaded = 0;
  let resolved = false;

  return new Promise((resolve) => {
    if (total === 0) return resolve();

    images.forEach(img => {
      const card = img.closest('.gallery-item');

      const onLoad = () => {
        loaded++;
        const ratio = loaded / total;
        if (!resolved && ratio >= threshold) {
          resolved = true;
          resolve();
        }
        img.classList.add('loaded');
        card.classList.add('visible');
      };

      img.addEventListener('load', onLoad);
      img.addEventListener('error', onLoad);

      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  });
}

// Load one page of vinyls into the grid
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

  temp.innerHTML = items.map(vinyl => {
    const url = `/vinyls/${vinyl.slug}/`;
    const cover = vinyl.cover || 'https://placehold.co/600x600?text=No+cover';

    return `
      <div class="col-md-4">
        <a href="${url}" class="text-decoration-none text-dark">
          <div class="card h-100 shadow-sm vinyl-card gallery-item hidden-until-loaded">
            <img src="${placeholder}" data-src="${cover}" class="card-img-top" alt="${vinyl.title}" loading="lazy"
              onerror="this.onerror=null;this.src='https://placehold.co/600x600?text=No+cover';">
            <div class="card-body">
              <h5 class="card-title">${vinyl.title}</h5>
              <p class="card-text">${vinyl.artist} (${vinyl.year})</p>
            </div>
          </div>
        </a>
      </div>
    `;
  }).join('');

  const newEls = [...temp.children];
  newEls.forEach(el => container.appendChild(el));

  lazyLoadVinyls(container).then(() => {
    page++;
    loading = false;
    document.getElementById('loading').style.display = 'none';
  });
}

// Scroll handler
function onScroll() {
  if (!loading && window.scrollY + window.innerHeight >= document.body.offsetHeight - 100) {
    loadMore();
  }
}

// Filter by artist
function filterByArtist() {
  if (activeArtist) {
    filteredVinyls = allVinyls.filter(v => v.artist === activeArtist);
  } else {
    filteredVinyls = allVinyls;
  }
  page = 0;
  document.getElementById('vinyl-grid').innerHTML = '';
  loadMore();
}

// Insert artist buttons into container
function renderArtistTags(data) {
  const artists = [...new Set(data.map(v => v.artist))].sort();
  const tagContainer = document.getElementById('artist-buttons');
  tagContainer.innerHTML = artists.map(artist => `
    <button class="btn btn-outline-secondary btn-sm me-2 mb-2" data-artist="${artist}">
      ${artist}
    </button>
  `).join('');
}

// Init logic
document.addEventListener('DOMContentLoaded', () => {
  // Ensure tags are collapsed on page load
  const collapseEl = document.getElementById('vinyl-tags');
  const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
  bsCollapse.hide();

  fetch('/assets/vinyls.json')
    .then(res => res.json())
    .then(data => {
      allVinyls = data;
      filteredVinyls = data;
      renderArtistTags(data);
      loadMore();
      window.addEventListener('scroll', onScroll);
    });

  document.addEventListener('click', e => {
    // Filter button clicked
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

      document.getElementById('vinyl-grid').innerHTML = '';
      page = 0;
      filterByArtist();
    }

    // Toggle collapse
    if (e.target.id === 'toggle-tags-btn') {
      const collapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
      collapse.toggle();
    }

    // Close button = hide + clear filter
    if (e.target.id === 'close-tags-btn') {
      activeArtist = null;
      document.querySelectorAll('[data-artist]').forEach(b => b.classList.remove('active'));

      const collapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
      collapse.hide();

      document.getElementById('vinyl-grid').innerHTML = '';
      page = 0;
      filterByArtist();
    }
  });
});

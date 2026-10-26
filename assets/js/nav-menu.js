document.addEventListener('DOMContentLoaded', () => {
  const headerRow = document.querySelector('.header-row');
  const username = document.querySelector('.username');
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  const ruler = document.getElementById('nav-ruler');
  if (!headerRow || !username || !toggle || !nav || !ruler) return;

  function closeMenu() {
    nav.classList.remove('is-open');
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }

  function openMenu() {
    nav.classList.add('is-open');
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open');
  }

  toggle.addEventListener('click', () => {
    nav.classList.contains('is-open') ? closeMenu() : openMenu();
  });

  nav.addEventListener('click', (ev) => {
    if (ev.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && nav.classList.contains('is-open')) closeMenu();
  });

  // Switch to the burger layout whenever the inline nav no longer fits next
  // to the logo on one line. Measured against #nav-ruler - a hidden copy of
  // the *full* nav/socials list (the visible nav omits the current page's
  // own link, which would otherwise make the breakpoint shift from page to
  // page) - rather than a fixed viewport width, so adding/removing nav
  // items never requires retuning a breakpoint.
  function updateLayout() {
    const wasCompact = headerRow.classList.contains('nav-compact');
    const gap = parseFloat(getComputedStyle(headerRow).columnGap) || 0;
    const needed = username.offsetWidth + ruler.scrollWidth + gap;
    const overflowing = needed > headerRow.clientWidth;
    headerRow.classList.toggle('nav-compact', overflowing);
    if (!overflowing && wasCompact) closeMenu();
    nav.style.visibility = 'visible';
  }

  updateLayout();
  window.addEventListener('resize', updateLayout);
});

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('scroll-top-btn');
  if (!btn) return;

  function updateVisibility() {
    btn.classList.toggle('is-visible', window.scrollY > 300);
  }

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  updateVisibility();
  window.addEventListener('scroll', updateVisibility);
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lab-item--expand').forEach((item) => {
    const toggle = item.querySelector('.lab-item__hit');
    const panel = item.querySelector('.lab-item__panel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', () => {
      const isOpen = item.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      panel.hidden = !isOpen;
    });
  });
});

/*!
 * docs.js - vanilla behavior for the /docs engine:
 *  - prefixes headings with an anchor link
 *  - toggles the mobile offcanvas nav
 * The sidebar (list of docs in this section) is build-time Liquid, not
 * JS - see the docs.html layout. No jQuery/Bootstrap dependency.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.content h1[id], .content h2[id], .content h3[id], .content h4[id], .content h5[id], .content h6[id]')
      .forEach(function (h) {
        var a = document.createElement('a');
        a.href = '#' + h.id;
        a.className = 'title-anchor-link';
        a.textContent = '#';
        h.insertBefore(a, h.firstChild);
        h.insertBefore(document.createTextNode(' '), a.nextSibling);
      });

    var offcanvasToggle = document.getElementById('docs-offcanvas-toggle');
    if (offcanvasToggle) {
      offcanvasToggle.addEventListener('click', function () {
        document.body.classList.toggle('offcanvas-expanded');
      });
    }
  });
})();

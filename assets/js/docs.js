/*!
 * docs.js - vanilla behavior for the /docs engine:
 *  - prefixes headings with an anchor link
 *  - toggles the mobile offcanvas nav
 *  - drives the Code/Preview tabs (.code-tabs)
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

    document.querySelectorAll('.code-tabs').forEach(function (bar) {
      var codeBlock = bar.nextElementSibling;
      var previewPanel = codeBlock && codeBlock.nextElementSibling;
      if (!codeBlock || !previewPanel || !previewPanel.classList.contains('code-tabs__preview')) {
        return;
      }

      var iframe = previewPanel.querySelector('iframe');
      var loaded = false;

      bar.querySelectorAll('.code-tabs__tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          bar.querySelectorAll('.code-tabs__tab').forEach(function (t) {
            t.classList.remove('is-active');
          });
          tab.classList.add('is-active');

          var showPreview = tab.dataset.tab === 'preview';
          codeBlock.hidden = showPreview;
          previewPanel.hidden = !showPreview;

          if (showPreview && !loaded && iframe) {
            loaded = true;
            iframe.addEventListener('load', function () {
              try {
                iframe.style.height = iframe.contentWindow.document.documentElement.scrollHeight + 'px';
              } catch (e) {
                // Cross-origin or detached document - keep the CSS min-height fallback.
              }
            });
            iframe.srcdoc = '<!doctype html><html><head><meta charset="utf-8">' +
              '<link rel="stylesheet" href="' + iframe.dataset.stylesheet + '">' +
              '</head><body>' + codeBlock.textContent + '</body></html>';
          }
        });
      });
    });
  });
})();

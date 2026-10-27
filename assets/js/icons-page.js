document.addEventListener('DOMContentLoaded', function () {
  var search = document.getElementById('icon-search');
  var tiles = Array.prototype.slice.call(document.querySelectorAll('.icon-tile'));
  var categories = Array.prototype.slice.call(document.querySelectorAll('.icon-category'));

  function applyFilter() {
    var query = (search.value || '').trim().toLowerCase();

    categories.forEach(function (section) {
      var visibleCount = 0;

      section.querySelectorAll('.icon-tile').forEach(function (tile) {
        var haystack = tile.dataset.name + ' ' + tile.dataset.tags;
        var match = !query || haystack.indexOf(query) !== -1;
        tile.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });

      section.style.display = visibleCount > 0 ? '' : 'none';
    });
  }

  if (search) {
    search.addEventListener('input', applyFilter);
  }

  function fallbackCopy(text, callback) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (_) { /* ignore */ }
    ta.remove();
    if (callback) callback();
  }

  function showFeedback(message) {
    var feedback = document.getElementById('icon-copy-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.add('visible');
    setTimeout(function () {
      feedback.classList.remove('visible');
    }, 1200);
  }

  tiles.forEach(function (tile) {
    tile.addEventListener('click', function () {
      var snippet = '<span class="rm-icon rm-icon-' + tile.dataset.name + '"></span>';

      function done() {
        showFeedback('Copied: ' + tile.dataset.name);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(snippet).then(done).catch(function () {
          fallbackCopy(snippet, done);
        });
      } else {
        fallbackCopy(snippet, done);
      }
    });
  });
});

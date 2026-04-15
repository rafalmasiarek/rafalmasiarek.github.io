<script>
  window.track = function (name, props) {
    try {
      if (typeof window.umami === 'function') {
        window.umami(name, props || {});
      }
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, props || {});
      }
    } catch (e) { }
  };
</script>

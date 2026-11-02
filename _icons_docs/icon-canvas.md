---
layout: docs
docs_collection: icons_docs
docs_home:
  url: /icons/
  title: Home
color_theme: blue
nav_order: 4
title: Icon canvas
extra_head: |
  <link href="https://cdn.masiarek.pl/icons/@latest/icons.min.css" rel="stylesheet">
extra_body: |
  <script src="https://cdn.masiarek.pl/icons/@latest/icons.min.js" defer></script>
  <script defer>
    window.Icons && window.Icons.configure({
      onError: function (err, info) {
        window.AppErrors && window.AppErrors.report(err, Object.assign({ component: 'icons' }, info));
      }
    });
  </script>
---

`icon-fw` gives every icon the same width, regardless of its own
aspect ratio - useful for aligning icons in menus or lists.

<div class="example"></div>

```html
<div><span class="icon icon-fw icon-gear"></span> Settings</div>
<div><span class="icon icon-fw icon-envelope"></span> Messages</div>
```

<div class="docs-example-preview">
  <div><span class="icon icon-fw icon-gear"></span> Settings</div>
  <div><span class="icon icon-fw icon-envelope"></span> Messages</div>
</div>

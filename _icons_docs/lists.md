---
layout: docs
docs_collection: icons_docs
docs_home:
  url: /icons/
  title: Home
color_theme: blue
nav_order: 5
title: Lists
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

`icon-ul` on a `<ul>` plus `icon-li` on the icon inside each `<li>`
replaces the default bullet with an icon.

<div class="example"></div>

```html
<ul class="icon-ul">
  <li><span class="icon icon-li icon-star"></span>First</li>
  <li><span class="icon icon-li icon-star"></span>Second</li>
</ul>
```

<div class="docs-example-preview">
  <ul class="icon-ul">
    <li><span class="icon icon-li icon-star"></span>First</li>
    <li><span class="icon icon-li icon-star"></span>Second</li>
  </ul>
</div>

---
layout: docs
docs_collection: lite_docs
docs_home:
  url: /docs/lite/
  title: Home
color_theme: blue
nav_order: 7
title: Pairing with icons
---

`Lite.css` has no icon set - pair it with
[`icons`](/docs/icons/) when a page needs one.

<div class="code-tabs">
  <button type="button" class="code-tabs__tab is-active" data-tab="code">Code</button>
  <button type="button" class="code-tabs__tab" data-tab="preview">Preview</button>
</div>

```html
<link rel="stylesheet" href="https://cdn.masiar.io/lite/@latest/lite.min.css">
<link rel="stylesheet" href="https://cdn.masiar.io/icons/@latest/icons.min.css">
<script src="https://cdn.masiar.io/icons/@latest/icons.min.js" defer></script>

<button type="button"><span class="icon icon-star-fill"></span> Open</button>
```

<div class="code-tabs__preview" hidden>
  <iframe class="code-tabs__iframe" title="Live preview" loading="lazy"
    data-stylesheet="https://cdn.masiar.io/lite/@latest/lite.min.css"></iframe>
</div>

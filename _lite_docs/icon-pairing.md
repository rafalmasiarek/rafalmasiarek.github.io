---
layout: docs
docs_collection: lite_docs
docs_home:
  url: /lite/
  title: Home
color_theme: blue
nav_order: 6
title: Pairing with icons
extra_head: |
  <link href="https://cdn.masiar.io/lite/@latest/lite.min.css" rel="stylesheet">
---

`lite.css` has no icon set — pair it with
[`icons`](/icons/) when a page needs one.

<div class="example"></div>

```html
<link rel="stylesheet" href="https://cdn.masiar.io/lite/@latest/lite.min.css">
<link rel="stylesheet" href="https://cdn.masiar.io/icons/@latest/icons.min.css">
<script src="https://cdn.masiar.io/icons/@latest/icons.min.js" defer></script>

<button type="button"><span class="icon icon-star-fill"></span> Open</button>
```

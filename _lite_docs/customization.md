---
layout: docs
docs_collection: lite_docs
docs_home:
  url: /lite/
  title: Home
color_theme: blue
nav_order: 7
title: Customization
extra_head: |
  <link href="https://cdn.masiar.io/lite/@latest/lite.min.css" rel="stylesheet">
---

Every color is a CSS custom property — redeclare one on `:root` after the
`<link>` instead of forking the file.

<div class="example"></div>

```html
<style>:root { --lite-accent: #16a34a; }</style>
```

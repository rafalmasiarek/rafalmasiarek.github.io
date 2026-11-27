---
layout: docs
docs_collection: lite_docs
docs_home:
  url: /lite/
  title: Home
color_theme: blue
nav_order: 4
title: Tables
extra_head: |
  <link href="https://cdn.masiar.io/lite/@latest/lite.min.css" rel="stylesheet">
---

A plain `table` assumes a header row. `.kv-table` is the other shape these
tools need — label/value rows with no header.

<div class="example"></div>

```html
<table>
  <thead><tr><th>Param</th><th>Default</th></tr></thead>
  <tbody><tr><td>limit</td><td>20</td></tr></tbody>
</table>

<table class="kv-table">
  <tr><td>Version</td><td>1.2.0</td></tr>
  <tr><td>License</td><td>MIT</td></tr>
</table>
```

<div class="docs-example-preview">
<div style="flex-direction: column; align-items: stretch; width: 100%; font-size: 1rem;">
<table>
<thead><tr><th>Param</th><th>Default</th></tr></thead>
<tbody><tr><td>limit</td><td>20</td></tr></tbody>
</table>
<table class="kv-table">
<tr><td>Version</td><td>1.2.0</td></tr>
<tr><td>License</td><td>MIT</td></tr>
</table>
</div>
</div>

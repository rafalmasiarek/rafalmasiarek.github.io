---
layout: docs
docs_collection: lite_docs
docs_home:
  url: /docs/lite/
  title: Home
color_theme: blue
nav_order: 5
title: Tables
---

## Header rows

A plain `table` assumes a header row.

<div class="code-tabs">
  <button type="button" class="code-tabs__tab is-active" data-tab="code">Code</button>
  <button type="button" class="code-tabs__tab" data-tab="preview">Preview</button>
</div>

```html
<table>
  <thead><tr><th>Param</th><th>Default</th></tr></thead>
  <tbody><tr><td>limit</td><td>20</td></tr></tbody>
</table>
```

<div class="code-tabs__preview" hidden>
  <iframe class="code-tabs__iframe" title="Live preview" loading="lazy"
    data-stylesheet="https://cdn.masiar.io/lite/@latest/lite.min.css"></iframe>
</div>

## Key-value rows

`.kv-table` is the other shape - label/value rows with no header.

<div class="code-tabs">
  <button type="button" class="code-tabs__tab is-active" data-tab="code">Code</button>
  <button type="button" class="code-tabs__tab" data-tab="preview">Preview</button>
</div>

```html
<table class="kv-table">
  <tr><td>Version</td><td>1.2.0</td></tr>
  <tr><td>License</td><td>MIT</td></tr>
</table>
```

<div class="code-tabs__preview" hidden>
  <iframe class="code-tabs__iframe" title="Live preview" loading="lazy"
    data-stylesheet="https://cdn.masiar.io/lite/@latest/lite.min.css"></iframe>
</div>

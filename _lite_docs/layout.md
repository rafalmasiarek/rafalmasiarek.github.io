---
layout: docs
docs_collection: lite_docs
docs_home:
  url: /docs/lite/
  title: Home
color_theme: blue
nav_order: 3
title: Layout
---

Put two fields side by side with `.row`, or group related checkboxes with
`.checkboxes`.

<div class="code-tabs">
  <button type="button" class="code-tabs__tab is-active" data-tab="code">Code</button>
  <button type="button" class="code-tabs__tab" data-tab="preview">Preview</button>
</div>

```html
<div class="row">
  <div><label for="city">City</label><input id="city" type="text"></div>
  <div><label for="zip">Postal code</label><input id="zip" type="text"></div>
</div>
<div class="checkboxes">
  <label><input type="checkbox" checked> Option A</label>
  <label><input type="checkbox"> Option B</label>
</div>
```

<div class="code-tabs__preview" hidden>
  <iframe class="code-tabs__iframe" title="Live preview" loading="lazy"
    data-stylesheet="https://cdn.masiar.io/lite/@latest/lite.min.css"></iframe>
</div>

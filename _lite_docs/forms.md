---
layout: docs
docs_collection: lite_docs
docs_home:
  url: /docs/lite/
  title: Home
color_theme: blue
nav_order: 2
title: Forms
---

Plain `label`, `input`, and `button` elements are styled with no classes
required.

<div class="code-tabs">
  <button type="button" class="code-tabs__tab is-active" data-tab="code">Code</button>
  <button type="button" class="code-tabs__tab" data-tab="preview">Preview</button>
</div>

```html
<label for="name">Name</label>
<input id="name" type="text" placeholder="Jane Doe">
<button type="button">Submit</button>
```

<div class="code-tabs__preview" hidden>
  <iframe class="code-tabs__iframe" title="Live preview" loading="lazy"
    data-stylesheet="https://cdn.masiar.io/lite/@latest/lite.min.css"></iframe>
</div>

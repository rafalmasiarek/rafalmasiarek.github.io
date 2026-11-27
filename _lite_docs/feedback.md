---
layout: docs
docs_collection: lite_docs
docs_home:
  url: /docs/lite/
  title: Home
color_theme: blue
nav_order: 4
title: Feedback
---

Four status boxes are built in: `.error`, `.success`, `.warning`, and
`.info`.

<div class="code-tabs">
  <button type="button" class="code-tabs__tab is-active" data-tab="code">Code</button>
  <button type="button" class="code-tabs__tab" data-tab="preview">Preview</button>
</div>

```html
<div class="error">Something went wrong.</div>
<div class="success">Saved successfully.</div>
<div class="warning">This action cannot be undone.</div>
<div class="info">A new version is available.</div>
```

<div class="code-tabs__preview" hidden>
  <iframe class="code-tabs__iframe" title="Live preview" loading="lazy"
    data-stylesheet="https://cdn.masiar.io/lite/@latest/lite.min.css"></iframe>
</div>

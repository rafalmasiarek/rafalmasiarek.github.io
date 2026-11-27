---
layout: docs
docs_collection: lite_docs
docs_home:
  url: /lite/
  title: Home
color_theme: blue
nav_order: 2
title: Layout
extra_head: |
  <link href="https://cdn.masiar.io/lite/@latest/lite.min.css" rel="stylesheet">
---

Put two fields side by side with `.row`, or group related checkboxes with
`.checkboxes`.

<div class="example"></div>

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

<div class="docs-example-preview">
<div style="flex-direction: column; align-items: stretch; width: 100%;">
<div class="row">
<div><label for="demo-city">City</label><input id="demo-city" type="text"></div>
<div><label for="demo-zip">Postal code</label><input id="demo-zip" type="text"></div>
</div>
<div class="checkboxes">
<label><input type="checkbox" checked> Option A</label>
<label><input type="checkbox"> Option B</label>
</div>
</div>
</div>

---
layout: docs
docs_collection: lite_docs
docs_home:
  url: /docs/lite/
  title: Home
color_theme: blue
nav_order: 6
title: Code
---

Wrap command output or any monospace block in a plain `pre`.

<div class="code-tabs">
  <button type="button" class="code-tabs__tab is-active" data-tab="code">Code</button>
  <button type="button" class="code-tabs__tab" data-tab="preview">Preview</button>
</div>

```html
<pre>GET /status -> 200 OK</pre>
```

<div class="code-tabs__preview" hidden>
  <iframe class="code-tabs__iframe" title="Live preview" loading="lazy"
    data-stylesheet="https://cdn.masiar.io/lite/@latest/lite.min.css"></iframe>
</div>

For longer code listings, pair `pre`/`code` with a dedicated highlighter
such as [highlight.js](https://highlightjs.org/) instead of hand-styling
them.

<div class="code-tabs">
  <button type="button" class="code-tabs__tab is-active" data-tab="code">Code</button>
  <button type="button" class="code-tabs__tab" data-tab="preview">Preview</button>
</div>

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

<h3>Example Code</h3>
<pre><code class="language-javascript">function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const onResize = debounce(() => {
  console.log('resized');
}, 200);

window.addEventListener('resize', onResize);
</code></pre>

<script>hljs.highlightAll();</script>
```

<div class="code-tabs__preview" hidden>
  <iframe class="code-tabs__iframe" title="Live preview" loading="lazy"
    data-stylesheet="https://cdn.masiar.io/lite/@latest/lite.min.css"></iframe>
</div>

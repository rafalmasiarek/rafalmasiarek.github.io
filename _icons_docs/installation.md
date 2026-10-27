---
layout: docs
docs_collection: icons_docs
docs_home:
  url: /icons/
  title: Home
color_theme: blue
nav_order: 1
title: Installation
extra_head: |
  <link href="/assets/css/rm-icons.css" rel="stylesheet">
extra_body: |
  <script src="/assets/js/rm-icons.js" defer></script>
---

`rm-icons` is a small, dependency-free SVG icon loader: a classic
`<script>`/`<link>` tag pair that lazily fetches and inlines an icon by
name from a configurable URL. Browse the full icon set on the
[Icons page](/icons/).

<div class="callout callout--info">
  <p><strong>Lazy by design.</strong> Icons are only fetched once their
  element scrolls into view (<code>IntersectionObserver</code>), and every
  <code>&lt;script&gt;</code> tag is loaded with <code>defer</code> - the
  loader never blocks page parsing.</p>
</div>

## Getting started

Load the stylesheet and script, then reference any icon by name.

<div class="example"></div>

```html
<link rel="stylesheet" href="https://cdn.masiarek.pl/rm-icons/@stable/rm-icons.min.css">
<script src="https://cdn.masiarek.pl/rm-icons/@stable/rm-icons.min.js"></script>

<span class="rm-icon rm-icon-github"></span>
```

<div class="callout callout--info">
  <p><strong>Versioning.</strong> <code>@stable</code> always points at the
  latest stable release. Pin a specific version instead with
  <code>/rm-icons/v1.0.0/rm-icons.min.js</code>, or a major/minor line with
  <code>/rm-icons/stable/v1/</code> - see the
  <a href="https://cdn.masiarek.pl/" target="_blank" rel="noopener">CDN index</a>
  for every published version.</p>
</div>

## Overriding the prefix or icon source

Set `data-prefix` / `data-base-url` on the script tag, or call
`RMIcons.configure({ prefix, baseUrl })` before the page scans for icons.

<div class="example"></div>

```html
<script src="https://cdn.masiarek.pl/rm-icons/@stable/rm-icons.min.js"
  data-prefix="my-icon"
  data-base-url="https://example.com/icons"></script>
```

<div class="callout callout--warning">
  <p><strong>CSS classes keep the default prefix.</strong> A custom
  <code>data-prefix</code> only changes how icons are detected and
  fetched - the ready-made size/canvas/list/rotate/animate classes
  documented on the following pages are static CSS, still written as
  <code>rm-icon-*</code>.</p>
</div>

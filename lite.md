---
layout: docs
color_theme: blue
scroll_top: true
title: lite.css
description: Classless-first base CSS for small single-purpose tools. Link one file, write plain HTML, done.
permalink: /lite/
extra_head: |
  <link href="https://cdn.masiar.io/lite/@latest/lite.min.css" rel="stylesheet">
---

One file, no classes required for the basics, no JS, no dark mode, no grid
system. Link it and write plain semantic HTML.

<div class="example"></div>

```html
<link rel="stylesheet" href="https://cdn.masiar.io/lite/@latest/lite.min.css">
```

## Forms

<div class="example"></div>

```html
<label for="name">Name</label>
<input id="name" type="text" placeholder="Jane Doe">
<button type="button">Generate</button>
```

<div class="docs-example-preview">
<div>
<label for="demo-name">Name</label>
<input id="demo-name" type="text" placeholder="Jane Doe">
<button type="button">Generate</button>
</div>
</div>

## Fields side by side (`.row`) and grouped checkboxes (`.checkboxes`)

<div class="example"></div>

```html
<div class="row">
  <div><label for="w">Width</label><input id="w" type="number" value="300"></div>
  <div><label for="h">Height</label><input id="h" type="number" value="300"></div>
</div>
<div class="checkboxes">
  <label><input type="checkbox" checked> Symbols</label>
  <label><input type="checkbox"> Hardcore</label>
</div>
```

<div class="docs-example-preview">
<div style="flex-direction: column; align-items: stretch; width: 100%;">
<div class="row">
<div><label for="demo-w">Width</label><input id="demo-w" type="number" value="300"></div>
<div><label for="demo-h">Height</label><input id="demo-h" type="number" value="300"></div>
</div>
<div class="checkboxes">
<label><input type="checkbox" checked> Symbols</label>
<label><input type="checkbox"> Hardcore</label>
</div>
</div>
</div>

## Error box (`.error`)

<div class="example"></div>

```html
<div class="error">Something went wrong.</div>
```

<div class="docs-example-preview">
<div style="width: 100%;">
<div class="error">Something went wrong.</div>
</div>
</div>

## Tables

A plain `table` assumes a header row. `.kv-table` is the other shape these
tools need — label/value rows with no header.

<div class="example"></div>

```html
<table>
  <thead><tr><th>Param</th><th>Default</th></tr></thead>
  <tbody><tr><td>l</td><td>12</td></tr></tbody>
</table>

<table class="kv-table">
  <tr><td>IP</td><td>1.2.3.4</td></tr>
  <tr><td>Country</td><td>Poland</td></tr>
</table>
```

<div class="docs-example-preview">
<div style="flex-direction: column; align-items: stretch; width: 100%; font-size: 1rem;">
<table>
<thead><tr><th>Param</th><th>Default</th></tr></thead>
<tbody><tr><td>l</td><td>12</td></tr></tbody>
</table>
<table class="kv-table">
<tr><td>IP</td><td>1.2.3.4</td></tr>
<tr><td>Country</td><td>Poland</td></tr>
</table>
</div>
</div>

## Code

<div class="example"></div>

```html
<pre>curl 'https://p.masiar.io/?l=20'</pre>
```

<div class="docs-example-preview">
<div style="width: 100%; font-size: 1rem;">
<pre>curl 'https://p.masiar.io/?l=20'</pre>
</div>
</div>

## With icons

`lite.css` has no icon set — pair it with
[`@cdn/icons`](/icons/) when a page needs one:

<div class="example"></div>

```html
<link rel="stylesheet" href="https://cdn.masiar.io/lite/@latest/lite.min.css">
<link rel="stylesheet" href="https://cdn.masiar.io/icons/@latest/icons.min.css">
<script src="https://cdn.masiar.io/icons/@latest/icons.min.js" defer></script>

<button type="button"><span class="icon icon-dice-5-fill"></span> Generate</button>
```

## Overriding a default

Every color is a CSS custom property — redeclare one on `:root` after the
`<link>` instead of forking the file:

<div class="example"></div>

```html
<style>:root { --lite-accent: #16a34a; }</style>
```

---
layout: docs
docs_collection: icons_docs
docs_home:
  url: /icons/
  title: Home
color_theme: blue
scroll_top: true
title: Icons
description: Browse and search the full icon set, or read the docs to use icons in your own project.
permalink: /icons/
extra_head: |
  <link href="https://cdn.masiarek.pl/icons/@latest/icons.min.css" rel="stylesheet">
extra_body: |
  <script src="https://cdn.masiarek.pl/icons/@latest/icons.min.js" defer></script>
  <script defer>
    window.Icons && window.Icons.configure({
      onError: function (err, info) {
        window.AppErrors && window.AppErrors.report(err, Object.assign({ component: 'icons' }, info));
      }
    });
  </script>
  <script src="/assets/js/icons-page.js" defer></script>
---

From [Bootstrap Icons](https://icons.getbootstrap.com) (MIT), served through `icons`. Click any icon to
copy its usage snippet.

<input type="search" id="icon-search" class="icon-search" placeholder="Search icons" autocomplete="off">

<div id="icon-copy-feedback" class="icon-copy-feedback" aria-live="polite"></div>

{%- assign icons_by_category = site.data.icons | group_by_exp: "icon", "icon.categories[0]" -%}
{%- assign icons_by_category = icons_by_category | sort: "name" -%}
{%- for group in icons_by_category -%}
<section class="icon-category" data-category="{{ group.name | downcase }}">
  <h2 class="icon-category__title">{{ group.name | default: "Other" }}</h2>
  <div class="icon-grid">
    {%- for icon in group.items -%}
    <button type="button" class="icon-tile" data-name="{{ icon.name }}"
      data-tags="{{ icon.tags | join: ' ' | downcase }}" title="{{ icon.title }}">
      <span class="icon icon-{{ icon.name }}" aria-hidden="true"></span>
      <span class="icon-tile__name">{{ icon.name }}</span>
    </button>
    {%- endfor -%}
  </div>
</section>
{%- endfor -%}

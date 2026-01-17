<?php snippet('header') ?>

<main class="container">
  <h1><?= esc($page->title()) ?></h1>

  <article>
    <?= $page->text()->kt() ?>
  </article>
</main>

<?php snippet('footer') ?>

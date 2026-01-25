<?php
declare(strict_types=1);

/** @var string $content */
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <?php snippet('site-head') ?>
  <?php
    $extraHead = $page->content()->get('extra_head');
    if ($extraHead->isNotEmpty()) {
        echo $extraHead->value();
    }
  ?>
</head>
<body>
  <?php snippet('site-header') ?>

  <div class="content" id="container">
    <?= $content ?>
  </div>

  <?php snippet('site-footer') ?>

  <script src="https://cdn.masiarek.pl/bootstrap/v5.3.8/bootstrap.bundle.min.js" integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI" crossorigin="anonymous" defer></script>

  <?php snippet('site-analytics') ?>
  <?php snippet('analytics-helper') ?>
  <?php snippet('site-scripts') ?>

  <?php
    $extraBody = $page->content()->get('extra_body');
    if ($extraBody->isNotEmpty()) {
        echo $extraBody->value();
    }
  ?>
</body>
</html>

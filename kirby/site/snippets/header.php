<?php
declare(strict_types=1);

/** @var string $content */
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= esc($page->title()) ?></title>

  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('main.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body>
<header class="container">
  <nav>
    <a href="/">Home</a>
    <a href="/projects">Projects</a>
  </nav>
</header>
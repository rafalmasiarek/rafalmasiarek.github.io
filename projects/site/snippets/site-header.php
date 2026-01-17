<?php
declare(strict_types=1);

$baseurl = (string)option('baseurl');
$siteTitle = (string)option('title');

$baseurl = trim($baseurl);
if ($baseurl === '' || $baseurl === '/') {
    $baseurl = '';
} else {
    $baseurl = '/' . trim($baseurl, '/');
}

// In Kirby we store optional icon in a page field "icon"
$iconField = $page->content()->get('icon');
$icon = $iconField->isNotEmpty() ? (string)$iconField->value() : '';
?>
<header>
  <p class="username">
    <a href="<?= htmlspecialchars($baseurl . '/', ENT_QUOTES, 'UTF-8') ?>" target="_self">
      <?= htmlspecialchars($siteTitle, ENT_QUOTES, 'UTF-8') ?>
    </a>
    <?php if ($icon !== ''): ?>
      <i class="<?= htmlspecialchars($icon, ENT_QUOTES, 'UTF-8') ?>"></i>
    <?php endif; ?>
  </p>
</header>

<?php
declare(strict_types=1);

$siteTitle = (string)option('title');
$siteDesc  = (string)option('description');
$baseurl   = (string)option('baseurl');           // "" or "/something"
$siteUrl   = (string)option('jekyll_site_url');   // original Jekyll site.url

$baseurl = trim($baseurl);
if ($baseurl === '' || $baseurl === '/') {
    $baseurl = '';
} else {
    $baseurl = '/' . trim($baseurl, '/');
}

$pageTitle = (string)$page->title()->value();
$fullTitle = $pageTitle !== '' && $pageTitle !== 'About me'
    ? $pageTitle . ' - ' . $siteTitle
    : $siteTitle;

$descField = $page->content()->get('description');
$desc = $descField->isNotEmpty() ? (string)$descField->value() : $siteDesc;
$desc = mb_substr($desc, 0, 160);

$canonicalField = $page->content()->get('canonical');
$canonical = $canonicalField->isNotEmpty()
    ? (string)$canonicalField->value()
    : rtrim($siteUrl, '/') . $baseurl . $page->url();
?>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1.0, shrink-to-fit=no">

<title><?= htmlspecialchars($fullTitle, ENT_QUOTES, 'UTF-8') ?></title>

<meta id="meta-desc" name="description" content="<?= htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') ?>">
<meta itemprop="description" name="description" content="<?= htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') ?>">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@100..700&display=swap" rel="stylesheet">

<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

<?php if ((string)getenv('APP_ENV') === 'production'): ?>
<link href="<?= $baseurl ?>/assets/css/style.min.css?<?= time() ?>" rel="stylesheet">
<?php else: ?>
<link href="<?= $baseurl ?>/assets/css/style.css?<?= time() ?>" rel="stylesheet">
<?php endif; ?>

<link href="<?= $baseurl ?>/assets/css/instafilters.min.css?v0.1.4" rel="stylesheet">

<script src="https://kit.fontawesome.com/cc759ba0dc.js" crossorigin="anonymous"></script>

<link id="canonical-link" rel="canonical" href="<?= htmlspecialchars($canonical, ENT_QUOTES, 'UTF-8') ?>">

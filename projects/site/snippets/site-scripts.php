<?php
// projects/site/snippets/site-scripts.php

declare(strict_types=1);

$baseurl = (string)option('baseurl');
$baseurl = trim($baseurl);
if ($baseurl === '' || $baseurl === '/') {
    $baseurl = '';
} else {
    $baseurl = '/' . trim($baseurl, '/');
}

$isProd = ((string)getenv('APP_ENV') === 'production');


$docroot = dirname(__DIR__, 4);
$verFile = $docroot . '/_asset_version.txt';
$assetVer = is_file($verFile) ? trim((string)file_get_contents($verFile)) : '';
$assetVerQ = $assetVer !== '' ? ('?v=' . rawurlencode($assetVer)) : '';
?>
<?php if ($isProd): ?>
    <script src="<?= $baseurl ?>/assets/js/analytics-events.min.js<?= $assetVerQ ?>" defer></script>
    <script src="https://cdn.masiarek.pl/twemoji-windows/@latest/twemoji-windows.min.js" defer></script>
<?php else: ?>
    <script src="<?= $baseurl ?>/assets/js/analytics-events.js<?= $assetVerQ ?>" defer></script>
    <script src="https://cdn.masiarek.pl/twemoji-windows/@latest/twemoji-windows.js<?= $assetVerQ ?>" defer></script>
<?php endif; ?>

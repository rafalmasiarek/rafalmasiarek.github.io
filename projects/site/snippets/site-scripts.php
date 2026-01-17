<?php
declare(strict_types=1);

$baseurl = (string)option('baseurl');
$baseurl = trim($baseurl);
if ($baseurl === '' || $baseurl === '/') {
    $baseurl = '';
} else {
    $baseurl = '/' . trim($baseurl, '/');
}

$isProd = ((string)getenv('APP_ENV') === 'production');
$ts = (string)time();
?>
<?php if ($isProd): ?>
<script src="<?= $baseurl ?>/assets/js/analytics-events.min.js?<?= $ts ?>" defer></script>
<script src="<?= $baseurl ?>/assets/js/twemoji-windows.min.js?<?= $ts ?>"></script>
<?php else: ?>
<script src="<?= $baseurl ?>/assets/js/analytics-events.js?<?= $ts ?>" defer></script>
<script src="<?= $baseurl ?>/assets/js/twemoji-windows.js?<?= $ts ?>"></script>
<?php endif; ?>

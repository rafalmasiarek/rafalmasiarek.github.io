<?php

declare(strict_types=1);

$isProd = ((string)option('app_env', 'development') === 'production');
?>
<?php if ($isProd): ?>
    <script src="<?= htmlspecialchars(asset_url('js/analytics-events.min.js'), ENT_QUOTES, 'UTF-8') ?>" defer></script>
<?php else: ?>
    <script src="<?= htmlspecialchars(asset_url('js/analytics-events.js'), ENT_QUOTES, 'UTF-8') ?>" defer></script>
<?php endif; ?>
<script src="<?= htmlspecialchars(asset_url('twemoji-windows/@latest/twemoji-windows.min.js', 'cdn'), ENT_QUOTES, 'UTF-8') ?>" defer></script>
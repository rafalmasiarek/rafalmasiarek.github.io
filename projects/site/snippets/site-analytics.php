<?php
declare(strict_types=1);

$env = (string)getenv('APP_ENV');
if ($env !== 'production') {
    return;
}

$analytics = (array)option('analytics');
if ($analytics === []) {
    return;
}

// Umami
$umami = (array)($analytics['umami'] ?? []);
if (($umami['enabled'] ?? false) === true) {
    $src = (string)$umami['src'];
    $websiteId = (string)$umami['website_id'];
    $domains = (string)($umami['domains'] ?? '');
    $autoTrack = $umami['auto_track'] ?? null;
    ?>
    <script defer
      src="<?= htmlspecialchars($src, ENT_QUOTES, 'UTF-8') ?>"
      data-website-id="<?= htmlspecialchars($websiteId, ENT_QUOTES, 'UTF-8') ?>"
      <?= $domains !== '' ? 'data-domains="' . htmlspecialchars($domains, ENT_QUOTES, 'UTF-8') . '"' : '' ?>
      <?= ($autoTrack === false) ? 'data-auto-track="false"' : '' ?>
    ></script>
    <?php
}

// GA4
$ga4 = (array)($analytics['ga4'] ?? []);
if (($ga4['enabled'] ?? false) === true && !empty($ga4['measurement_id'])) {
    $mid = (string)$ga4['measurement_id'];
    ?>
    <script async src="https://www.googletagmanager.com/gtag/js?id=<?= htmlspecialchars($mid, ENT_QUOTES, 'UTF-8') ?>"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){ dataLayer.push(arguments); }
      gtag('js', new Date());
      gtag('config', '<?= htmlspecialchars($mid, ENT_QUOTES, 'UTF-8') ?>', { anonymize_ip: true });
    </script>
    <?php
}

<?php
declare(strict_types=1);

$baseurl = (string)option('baseurl');
$baseurl = trim($baseurl);
if ($baseurl === '' || $baseurl === '/') {
    $baseurl = '';
} else {
    $baseurl = '/' . trim($baseurl, '/');
}

$currentRaw = (string)$page->url();
$currentRaw = str_replace('index.html', '', $currentRaw);
$currentRaw = preg_replace('~//+~', '/', $currentRaw) ?? $currentRaw;

$parts = array_values(array_filter(explode('/', $currentRaw), static fn($p) => $p !== ''));
$currentNorm = '';
foreach ($parts as $p) {
    $currentNorm .= '/' . $p;
}
if ($currentNorm === '') {
    $currentNorm = '/';
}
$currentAbs = preg_replace('~//+~', '/', $baseurl . $currentNorm) ?? ($baseurl . $currentNorm);

$navItems = (array)option('nav');
$socials  = (array)option('socials');
?>
<footer>
  <nav class="navigation">
    <ul>
      <?php foreach ($navItems as $item): ?>
        <?php
          if (!is_array($item)) continue;

          $isHidden = $item['hidden'] ?? ($item['nav_hidden'] ?? null);
          if ($isHidden === true) continue;

          $title = (string)$item['title'];
          $url   = (string)$item['url'];

          $itemRaw = str_replace('index.html', '', $url);
          $itemRaw = preg_replace('~//+~', '/', $itemRaw) ?? $itemRaw;

          $itemParts = array_values(array_filter(explode('/', $itemRaw), static fn($p) => $p !== ''));
          $itemNorm = '';
          foreach ($itemParts as $p) {
              $itemNorm .= '/' . $p;
          }
          if ($itemNorm === '') {
              $itemNorm = '/';
          }

          $itemAbs = preg_replace('~//+~', '/', $baseurl . $itemNorm) ?? ($baseurl . $itemNorm);
          if ($itemAbs === $currentAbs) continue;
        ?>
        <li>
          <a href="<?= htmlspecialchars($itemAbs, ENT_QUOTES, 'UTF-8') ?>"
             style="border:0"
             data-track="nav"
             data-nav-title="<?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?>"
             data-nav-path="<?= htmlspecialchars($itemNorm, ENT_QUOTES, 'UTF-8') ?>">
            <?php if (!empty($item['icon'])): ?>
              <i class="<?= htmlspecialchars((string)$item['icon'], ENT_QUOTES, 'UTF-8') ?>"></i>
            <?php endif; ?>
            <?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?>
          </a>
        </li>
      <?php endforeach; ?>

      <?php foreach ($socials as $s): ?>
        <?php
          if (!is_array($s)) continue;

          $isHidden = $s['hidden'] ?? ($s['nav_hidden'] ?? null);
          if ($isHidden === true) continue;

          $title = (string)$s['title'];
          $url   = (string)$s['url'];
        ?>
        <li>
          <a href="<?= htmlspecialchars($url, ENT_QUOTES, 'UTF-8') ?>"
             style="border:0;text-decoration:none"
             target="_blank"
             rel="noopener"
             data-track="social"
             data-social="<?= htmlspecialchars(mb_strtolower($title), ENT_QUOTES, 'UTF-8') ?>">
            <?php if (!empty($s['icon'])): ?>
              <i class="<?= htmlspecialchars((string)$s['icon'], ENT_QUOTES, 'UTF-8') ?>"></i>
            <?php endif; ?>
            <?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?>
          </a>
        </li>
      <?php endforeach; ?>
    </ul>
  </nav>
</footer>

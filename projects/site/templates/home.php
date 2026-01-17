<?php

declare(strict_types=1);

ob_start();
?>
<main>
  <article class="md">
    <header class="heading">
      <h1 class="title"><?= htmlspecialchars($page->title()->value(), ENT_QUOTES, 'UTF-8') ?></h1>
    </header>

    <ul>
      <?php foreach ($page->children()->listed() as $p): ?>
        <?php $date = (string)$p->content()->get('date')->value(); ?>
        <li>
          <a href="<?= htmlspecialchars($p->url(), ENT_QUOTES, 'UTF-8') ?>">
            <?= htmlspecialchars($p->title()->value(), ENT_QUOTES, 'UTF-8') ?>
          </a>
          <?php if ($date !== ''): ?>
            <span class="timestamp"><?= htmlspecialchars($date, ENT_QUOTES, 'UTF-8') ?></span>
          <?php endif; ?>
        </li>
      <?php endforeach; ?>
    </ul>
  </article>
</main>
<?php
$content = ob_get_clean();
snippet('layout', ['content' => $content]);

<?php

declare(strict_types=1);
ob_start();
?>
<main>
  <article class="md">
    <header class="heading">
      <h1 class="title"><?= htmlspecialchars($page->title()->value(), ENT_QUOTES, 'UTF-8') ?></h1>
    </header>

    <?= $page->text()->kt() ?>
  </article>
</main>
<?php

$content = ob_get_clean();
snippet('layout', ['content' => $content]);

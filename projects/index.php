<?php

declare(strict_types=1);

/**
 * Kirby front controller for /projects
 *
 * Assumes Kirby core is available at: /projects/kirby
 * (add as git submodule later).
 */

require __DIR__ . '/kirby/bootstrap.php';

echo (new Kirby\Cms\App([
    'roots' => [
        'index'   => __DIR__,
        'base'    => __DIR__,
        'kirby'   => __DIR__ . '/kirby',
        'site'    => __DIR__ . '/site',
        'content' => __DIR__ . '/content',
        // Runtime roots intentionally NOT created here:
        // 'media'   => __DIR__ . '/media',
        // 'storage' => __DIR__ . '/storage',
    ],
    'urls' => [
        // Ensures generated URLs include /projects prefix
        'index' => '/projects',
    ],
]))->render();

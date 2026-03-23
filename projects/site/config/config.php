<?php

declare(strict_types=1);

use Kirby\Data\Yaml;

$rootPath = dirname(__DIR__, 3);

$jekyllConfigPaths = [
    $rootPath . '/_config.yml',
    $rootPath . '/_config.assets.yml',
];

$cfg = [];

foreach ($jekyllConfigPaths as $configPath) {
    if (!is_file($configPath)) {
        continue;
    }

    $parsed = Yaml::read($configPath);
    if (is_array($parsed)) {
        $cfg = array_replace_recursive($cfg, $parsed);
    }
}

$overrides = [];

$cfg = array_replace_recursive($cfg, $overrides);

// Compute Kirby canonical url
$siteUrl = (string)($cfg['url'] ?? '');
$baseurl = (string)($cfg['baseurl'] ?? '');

$baseurl = trim($baseurl);
if ($baseurl === '' || $baseurl === '/') {
    $baseurl = '';
} else {
    $baseurl = '/' . trim($baseurl, '/');
}

$cfg['url'] = $siteUrl !== ''
    ? rtrim($siteUrl, '/') . $baseurl . '/projects'
    : null;

$cfg['jekyll_site_url'] = $siteUrl;
$cfg['jekyll_root'] = $rootPath;

return $cfg;

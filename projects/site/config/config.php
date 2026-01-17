<?php

declare(strict_types=1);

use Kirby\Data\Yaml;

$jekyllPath = dirname(__DIR__, 3) . '/_config.yml';

$cfg = [];
if (is_file($jekyllPath)) {
    $parsed = Yaml::read($jekyllPath);
    if (is_array($parsed)) {
        $cfg = $parsed;
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
$cfg['home'] = 'projects';

// Return as Kirby options (top-level)
return $cfg;

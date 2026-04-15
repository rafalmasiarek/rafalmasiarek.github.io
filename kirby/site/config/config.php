<?php

declare(strict_types=1);

use Kirby\Data\Yaml;

$rootPath = dirname(__DIR__, 3);

$jekyllConfigPaths = [
    $rootPath . '/_config.yml',
    $rootPath . '/_config.deploy.yml',
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

$siteUrl = (string)($cfg['url'] ?? '');
$baseurl = (string)($cfg['baseurl'] ?? '');

$baseurl = trim($baseurl);
if ($baseurl === '' || $baseurl === '/') {
    $baseurl = '';
} else {
    $baseurl = '/' . trim($baseurl, '/');
}

$pathPrefix = kirby()->option('multisite.pathPrefix', '');
$siteKey = kirby()->option('multisite.key', 'projects');
$localSiteRoot = kirby()->option('multisite.localSiteRoot');

$cfg['url'] = $siteUrl !== ''
    ? rtrim($siteUrl, '/') . $baseurl . $pathPrefix
    : null;

$cfg['jekyll_site_url'] = $siteUrl;
$cfg['jekyll_root'] = $rootPath;
$cfg['multisite.key'] = $siteKey;
$cfg['multisite.pathPrefix'] = $pathPrefix;

$multisite = is_array($cfg['kirby']['multisite'] ?? null)
    ? $cfg['kirby']['multisite']
    : [];

$cfg['multisite.routes'] = is_array($multisite['routes'] ?? null)
    ? $multisite['routes']
    : [];

$cfg['multisite.hosts'] = is_array($multisite['hosts'] ?? null)
    ? $multisite['hosts']
    : [];

$localConfig = [];
$localConfigPath = $localSiteRoot ? $localSiteRoot . '/config/config.php' : null;

if ($localConfigPath && is_file($localConfigPath)) {
    $loaded = require $localConfigPath;
    if (is_array($loaded)) {
        $localConfig = $loaded;
    }
}

return array_replace_recursive($cfg, $localConfig);
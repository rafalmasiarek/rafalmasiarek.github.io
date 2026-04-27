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

$multisite = is_array($cfg['kirby']['multisite'] ?? null)
    ? $cfg['kirby']['multisite']
    : [];

$routes = is_array($multisite['routes'] ?? null)
    ? $multisite['routes']
    : [];

$hosts = is_array($multisite['hosts'] ?? null)
    ? $multisite['hosts']
    : [];

$host = strtolower(trim((string)($_SERVER['HTTP_HOST'] ?? '')));
$host = preg_replace('/:\d+$/', '', $host) ?? $host;

$requestUri = (string)($_SERVER['REQUEST_URI'] ?? '/');
$requestPath = trim((string)parse_url($requestUri, PHP_URL_PATH), '/');
$first = explode('/', $requestPath)[0] ?? '';

$siteMapByPath = [];

foreach ($routes as $routePath => $routeSiteKey) {
    $routePath = '/' . trim((string)$routePath, '/');
    $routeFirst = trim($routePath, '/');
    $routeFirst = explode('/', $routeFirst)[0] ?? '';

    if ($routeFirst !== '' && is_string($routeSiteKey) && $routeSiteKey !== '') {
        $siteMapByPath[$routeFirst] = $routeSiteKey;
    }
}

$siteKey = 'projects';
$pathPrefix = '';

if (isset($hosts[$host]) && is_string($hosts[$host]) && $hosts[$host] !== '') {
    $siteKey = $hosts[$host];
    $pathPrefix = '';
} elseif (isset($siteMapByPath[$first]) && is_string($siteMapByPath[$first]) && $siteMapByPath[$first] !== '') {
    $siteKey = $siteMapByPath[$first];
    $pathPrefix = '/' . $first;
}

$localSiteRoot = $rootPath . '/kirby/sites/' . $siteKey . '/site';
if (!is_dir($localSiteRoot)) {
    $localSiteRoot = null;
}

$cfg['url'] = $siteUrl !== ''
    ? rtrim($siteUrl, '/') . $baseurl . $pathPrefix
    : null;

$cfg['jekyll_site_url'] = $siteUrl;
$cfg['jekyll_root'] = $rootPath;
$cfg['multisite.key'] = $siteKey;
$cfg['multisite.pathPrefix'] = $pathPrefix;
$cfg['multisite.routes'] = $routes;
$cfg['multisite.hosts'] = $hosts;

$localConfig = [];
$localConfigPath = $localSiteRoot ? $localSiteRoot . '/config/config.php' : null;

if ($localConfigPath && is_file($localConfigPath)) {
    $loaded = require $localConfigPath;
    if (is_array($loaded)) {
        $localConfig = $loaded;
    }
}

return array_replace_recursive($cfg, $localConfig);

<?php

declare(strict_types=1);

require __DIR__ . '/core/bootstrap.php';

use Kirby\Cms\App;
use Kirby\Data\Yaml;

$repoRoot = dirname(__DIR__);
$jekyllConfigPaths = [
    $repoRoot . '/_config.yml',
    $repoRoot . '/_config.deploy.yml',
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

$multisite = is_array($cfg['kirby']['multisite'] ?? null)
    ? $cfg['kirby']['multisite']
    : [];

$hosts = is_array($multisite['hosts'] ?? null)
    ? $multisite['hosts']
    : [];

$routes = is_array($multisite['routes'] ?? null)
    ? $multisite['routes']
    : [];

$host = strtolower(trim((string)($_SERVER['HTTP_HOST'] ?? '')));
$host = preg_replace('/:\d+$/', '', $host) ?? $host;

$requestUri = (string)($_SERVER['REQUEST_URI'] ?? '/');
$requestPath = trim((string)parse_url($requestUri, PHP_URL_PATH), '/');
$first = explode('/', $requestPath)[0] ?? '';

$siteMapByPath = [];

foreach ($routes as $routePath => $siteKey) {
    $routePath = '/' . trim((string)$routePath, '/');
    $routeFirst = trim($routePath, '/');
    $routeFirst = explode('/', $routeFirst)[0] ?? '';

    if ($routeFirst !== '' && is_string($siteKey) && $siteKey !== '') {
        $siteMapByPath[$routeFirst] = $siteKey;
    }
}

$siteKey = null;
$pathPrefix = '';

if (isset($hosts[$host]) && is_string($hosts[$host]) && $hosts[$host] !== '') {
    $siteKey = $hosts[$host];
    $pathPrefix = '';
} elseif (isset($siteMapByPath[$first]) && is_string($siteMapByPath[$first]) && $siteMapByPath[$first] !== '') {
    $siteKey = $siteMapByPath[$first];
    $pathPrefix = '/' . $first;
}

if (!$siteKey) {
    http_response_code(404);
    exit('Unknown multisite target');
}

$siteBaseRoot = __DIR__ . '/sites/' . $siteKey;
$globalSiteRoot = __DIR__ . '/site';
$localSiteRoot  = $siteBaseRoot . '/site';
$resolvedSiteRoot = is_dir($localSiteRoot) ? $localSiteRoot : $globalSiteRoot;

echo (new App([
    'roots' => [
        'index'    => __DIR__,
        'base'     => __DIR__,
        'kirby'    => __DIR__ . '/core',
        'site'     => $resolvedSiteRoot,
        'content'  => $siteBaseRoot . '/content',
        'media'    => $siteBaseRoot . '/media',
        'storage'  => $siteBaseRoot . '/storage',
        'cache'    => $siteBaseRoot . '/cache',
        'logs'     => $siteBaseRoot . '/logs',
        'accounts' => __DIR__ . '/accounts',
        'sessions' => __DIR__ . '/sessions',
    ],
    'urls' => [
        'index' => $pathPrefix !== '' ? $pathPrefix : '/',
    ],
    'options' => [
        'multisite.key'            => $siteKey,
        'multisite.host'           => $host,
        'multisite.requestPath'    => $requestPath,
        'multisite.pathPrefix'     => $pathPrefix,
        'multisite.globalSiteRoot' => $globalSiteRoot,
        'multisite.localSiteRoot'  => is_dir($localSiteRoot) ? $localSiteRoot : null,
        'multisite.siteBaseRoot'   => $siteBaseRoot,
        'multisite.siteMapByPath'  => $siteMapByPath,
        'multisite.siteMapByHost'  => $hosts,
        'multisite.routes'         => $routes,
    ],
]))->render();

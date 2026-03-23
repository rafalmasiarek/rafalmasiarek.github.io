<?php

declare(strict_types=1);

use Kirby\Cms\App;

final class AssetUrl
{
    public static function build(string $input, ?string $sourceName = null, ?bool $bustOverride = null): string
    {
        $kirby = App::instance();

        $cfg = $kirby->option('assets', []);
        if (!is_array($cfg)) {
            $cfg = [];
        }

        $sources = $cfg['sources'] ?? [];
        if (!is_array($sources)) {
            $sources = [];
        }

        $defaultSource = (string)($cfg['default_source'] ?? 'local');
        $sourceKey = (string)($sourceName ?? $defaultSource);
        $source = $sources[$sourceKey] ?? [];

        if (!is_array($source)) {
            $source = [];
        }

        $baseUrl = rtrim((string)($source['base_url'] ?? ''), '/');
        $prefix = (string)($source['prefix'] ?? '');
        $strategy = (string)(
            $source['strategy']
            ?? $cfg['default_strategy']
            ?? 'config_version'
        );

        if ($bustOverride === null) {
            $bust = array_key_exists('bust', $source)
                ? (bool)$source['bust']
                : (bool)($cfg['default_bust'] ?? true);
        } else {
            $bust = $bustOverride;
        }

        $path = self::normalizePath($input, $prefix);
        $url = $baseUrl . $path;

        $version = null;
        if ($bust === true) {
            $version = self::resolveVersion($kirby, $cfg, $strategy, $path);
        }

        return self::appendVersion($url, $version);
    }

    public static function preconnects(): string
    {
        $kirby = App::instance();
        $cfg = $kirby->option('assets', []);
        if (!is_array($cfg)) {
            return '';
        }

        $sources = $cfg['sources'] ?? [];
        if (!is_array($sources)) {
            return '';
        }

        $seen = [];
        $html = [];

        foreach ($sources as $source) {
            if (!is_array($source)) {
                continue;
            }

            $baseUrl = trim((string)($source['base_url'] ?? ''));
            $preconnect = (bool)($source['preconnect'] ?? false);

            if ($preconnect !== true || $baseUrl === '' || !preg_match('~^https?://~i', $baseUrl)) {
                continue;
            }

            if (isset($seen[$baseUrl])) {
                continue;
            }

            $seen[$baseUrl] = true;
            $html[] = '<link rel="preconnect" href="' . htmlspecialchars($baseUrl, ENT_QUOTES, 'UTF-8') . '" crossorigin>';
        }

        return implode("\n", $html);
    }

    private static function normalizePath(string $input, string $prefix): string
    {
        $cleanInput = trim($input);

        if (preg_match('~^https?://~i', $cleanInput) === 1) {
            return $cleanInput;
        }

        if (str_starts_with($cleanInput, '/')) {
            return $cleanInput;
        }

        if (trim($prefix) === '') {
            return '/' . ltrim($cleanInput, '/');
        }

        $normalizedPrefix = '/' . trim($prefix, '/');
        return preg_replace('~/+~', '/', $normalizedPrefix . '/' . ltrim($cleanInput, '/')) ?: '';
    }

    private static function resolveVersion(App $kirby, array $cfg, string $strategy, string $path): ?string
    {
        return match ($strategy) {
            'file_hash'       => self::fileHashVersion($kirby, $cfg, $path),
            'config_version'  => self::configVersion($kirby, $cfg),
            'build_timestamp' => self::buildTimestamp($kirby, $cfg),
            'none'            => null,
            default           => self::configVersion($kirby, $cfg),
        };
    }

    private static function configVersion(App $kirby, array $cfg): ?string
    {
        $buildVersion = trim((string)$kirby->option('asset_build.version', ''));
        if ($buildVersion !== '') {
            return $buildVersion;
        }

        $fallback = trim((string)($cfg['version'] ?? ''));
        return $fallback !== '' ? $fallback : null;
    }

    private static function buildTimestamp(App $kirby, array $cfg): ?string
    {
        $configuredTimestamp = trim((string)$kirby->option('asset_build.timestamp', ''));
        if ($configuredTimestamp !== '') {
            return $configuredTimestamp;
        }

        return self::configVersion($kirby, $cfg);
    }

    private static function fileHashVersion(App $kirby, array $cfg, string $publicPath): ?string
    {
        $relativePath = ltrim($publicPath, '/');
        $root = trim((string)$kirby->option('jekyll_root', ''));

        if ($root !== '') {
            $filePath = rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);

            if (is_file($filePath)) {
                $hash = md5_file($filePath);
                if (is_string($hash) && $hash !== '') {
                    return $hash;
                }
            }
        }

        return self::configVersion($kirby, $cfg);
    }

    private static function appendVersion(string $url, ?string $version): string
    {
        if ($version === null || $version === '') {
            return $url;
        }

        $separator = str_contains($url, '?') ? '&' : '?';
        return $url . $separator . 'v=' . rawurlencode($version);
    }
}

if (!function_exists('asset_url')) {
    function asset_url(string $input, ?string $sourceName = null, ?bool $bustOverride = null): string
    {
        return AssetUrl::build($input, $sourceName, $bustOverride);
    }
}

if (!function_exists('asset_preconnects')) {
    function asset_preconnects(): string
    {
        return AssetUrl::preconnects();
    }
}

Kirby::plugin('rafalmasiarek/asset-url', []);
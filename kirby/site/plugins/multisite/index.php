<?php

declare(strict_types=1);

use Kirby\Cms\App as Kirby;
use Kirby\Cms\User;

if (!function_exists('currentSiteKey')) {
    function currentSiteKey(): string
    {
        return kirby()->option('multisite.key', 'projects');
    }
}

if (!function_exists('currentPathPrefix')) {
    function currentPathPrefix(): string
    {
        return trim(kirby()->option('multisite.pathPrefix', ''), '/');
    }
}

if (!function_exists('currentRequestPath')) {
    function currentRequestPath(): string
    {
        return trim(kirby()->option('multisite.requestPath', ''), '/');
    }
}

if (!function_exists('requestPathWithoutPrefix')) {
    function requestPathWithoutPrefix(): string
    {
        $path = currentRequestPath();
        $prefix = currentPathPrefix();

        if ($prefix !== '' && str_starts_with($path, $prefix . '/')) {
            return substr($path, strlen($prefix) + 1);
        }

        if ($path === $prefix) {
            return '';
        }

        return $path;
    }
}

if (!function_exists('currentRequestArea')) {
    function currentRequestArea(): string
    {
        $path = requestPathWithoutPrefix();
        $first = explode('/', $path)[0] ?? '';

        return match ($first) {
            'panel' => 'panel',
            'api'   => 'api',
            default => 'site',
        };
    }
}

if (!function_exists('globalSiteRoot')) {
    function globalSiteRoot(): string
    {
        return kirby()->option('multisite.globalSiteRoot');
    }
}

if (!function_exists('localSiteRoot')) {
    function localSiteRoot(): ?string
    {
        return kirby()->option('multisite.localSiteRoot');
    }
}

if (!function_exists('userHasSiteAccess')) {
    function userHasSiteAccess(?User $user = null): bool
    {
        $user ??= kirby()->user();

        if (!$user) {
            return false;
        }

        if ($user->role()->name() === 'admin') {
            return true;
        }

        $sites = $user->content()->get('sites')->yaml();

        return is_array($sites) && in_array(currentSiteKey(), $sites, true);
    }
}

Kirby::plugin('rafalmasiarek/multisite', [
    'hooks' => [
        'system.loadPlugins:after' => function () {
            if (!in_array(currentRequestArea(), ['panel', 'api'], true)) {
                return;
            }

            $user = kirby()->user();
            if (!$user) {
                return;
            }

            if (!userHasSiteAccess($user)) {
                http_response_code(403);
                exit('Forbidden');
            }
        },
    ],
]);
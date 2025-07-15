#!/usr/bin/env php
<?php

$envPath = __DIR__ . '/.env';
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        [$key, $val] = explode('=', $line, 2);
        $key = trim($key);
        $val = trim($val);

        $_ENV[$key] = $val;
        putenv("$key=$val");
    }
}

$discogsUsername = getenv('DISCOGS_USERNAME') ?? null;
$discogsToken = getenv('DISCOGS_TOKEN') ?? null;

if (!$discogsUsername || !$discogsToken) {
    echo "❌ Configuration missing: Please define DISCOGS_USERNAME and DISCOGS_TOKEN in your environment or .env file.\n";
    exit(1);
}

$userAgent = 'VinylCollectionFetcher/1.0';

$vinylDir = __DIR__ . '/../_vinyls';
$coverDir = __DIR__ . '/../assets/vinyl_covers';

if (!is_dir($vinylDir)) mkdir($vinylDir, 0755, true);
if (!is_dir($coverDir)) mkdir($coverDir, 0755, true);

$page = 1;
$perPage = 100;
$allReleases = [];

do {
    $url = "https://api.discogs.com/users/$discogsUsername/collection/folders/0/releases?page=$page&per_page=$perPage&token=$discogsToken";

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERAGENT => $userAgent,
    ]);
    $resp = curl_exec($ch);
    $data = json_decode($resp, true);
    curl_close($ch);

    if (!isset($data['releases'])) {
        echo "❌ Nie udało się pobrać danych z Discogs\n";
        exit(1);
    }

    $allReleases = array_merge($allReleases, $data['releases']);
    $page++;
} while (count($data['releases']) === $perPage);

$validDiscogsIds = [];

foreach ($allReleases as $entry) {
    $info = $entry['basic_information'];
    $discogsId = $entry['id'];
    $validDiscogsIds[] = $discogsId;

    $artist = $info['artists'][0]['name'] ?? 'Unknown Artist';
    $title = $info['title'] ?? 'Unknown Title';
    $year = $info['year'] ?? null;
    $cover = $info['cover_image'] ?? null;

    $slugArtist = slugify($artist);
    $slugTitle = slugify($title);
    $slug = "$slugArtist-$slugTitle";
    $mdFile = "$slug.md";
    $coverFile = "$slug.jpg";

    $filepath = "$vinylDir/$mdFile";
    $coverpath = "$coverDir/$coverFile";

    if (file_exists($filepath)) {
        echo "⏭️  Plik istnieje: $mdFile\n";
    } else {
        $frontMatter = "---\n";
        $frontMatter .= "layout: vinyl\n";
        $frontMatter .= "title: \"$title\"\n";
        $frontMatter .= "artist: \"$artist\"\n";
        if ($year) $frontMatter .= "year: $year\n";
        $frontMatter .= "discogs_id: $discogsId\n";
        $frontMatter .= "---\n\n";
        $frontMatter .= "_Opis wkrótce..._\n";
        file_put_contents($filepath, $frontMatter);
        echo "✅ Dodano plik: $mdFile\n";
    }

    if ($cover && !file_exists($coverpath)) {
        file_put_contents($coverpath, file_get_contents($cover));
        echo "⬇️  Cover: $coverFile\n";
    }
}

if (in_array('--clean', $argv)) {
    echo "🧹 Tryb czyszczenia aktywny...\n";
    foreach (glob("$vinylDir/*.md") as $file) {
        $content = file_get_contents($file);
        if (preg_match('/^discogs_id:\s*(\d+)/m', $content, $m)) {
            $id = (int)$m[1];
            if (!in_array($id, $validDiscogsIds)) {
                $slug = basename($file, '.md');
                unlink($file);
                echo "🗑️  Usunięto plik: $slug.md\n";

                $coverPath = "$coverDir/$slug.jpg";
                if (file_exists($coverPath)) {
                    unlink($coverPath);
                    echo "🗑️  Usunięto cover: $slug.jpg\n";
                }
            }
        }
    }
}

function slugify($str) {
    $str = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str);
    $str = strtolower(trim($str));
    $str = preg_replace('/[^a-z0-9]+/', '-', $str);
    return trim($str, '-');
}

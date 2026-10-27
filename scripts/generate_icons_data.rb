#!/usr/bin/env ruby
# frozen_string_literal: true

# Regenerates _data/icons.yml from Bootstrap Icons' own per-icon doc pages.
#
# Bootstrap Icons ships no single categorized manifest, but every icon has
# its own doc page with YAML front matter (docs/content/icons/<name>.md),
# e.g.:
#
#   ---
#   title: Alarm Fill
#   categories:
#     - Devices
#   tags:
#     - alarm
#     - clock
#     - time
#   ---
#
# Run manually whenever Bootstrap Icons ships new icons:
#
#   ruby scripts/generate_icons_data.rb
#
# Clones the upstream repo (avoids GitHub API pagination/rate-limit issues -
# the Contents API silently truncates listings at 1000 of the library's
# 2000+ icons) and writes the result to _data/icons.yml.

require 'yaml'
require 'fileutils'
require 'tmpdir'

REPO_URL = 'https://github.com/twbs/icons'
OUTPUT_PATH = File.join(__dir__, '..', '_data', 'icons.yml')

Dir.mktmpdir do |tmp|
  puts "Cloning #{REPO_URL} (shallow)..."
  system('git', 'clone', '--depth', '1', REPO_URL, tmp, exception: true)

  docs_dir = File.join(tmp, 'docs', 'content', 'icons')
  paths = Dir.glob(File.join(docs_dir, '*.md')).sort

  raise "No icon doc pages found under #{docs_dir}" if paths.empty?

  icons = paths.map do |path|
    name = File.basename(path, '.md')
    front_matter = File.read(path)[/\A---\n(.*?)\n---/m, 1]
    meta = front_matter ? YAML.safe_load(front_matter, permitted_classes: [], aliases: false) : {}

    {
      'name' => name,
      'title' => meta['title'] || name,
      'categories' => Array(meta['categories']),
      'tags' => Array(meta['tags'])
    }
  end

  FileUtils.mkdir_p(File.dirname(OUTPUT_PATH))
  File.write(OUTPUT_PATH, icons.to_yaml)

  puts "Wrote #{icons.size} icons to #{OUTPUT_PATH}"
end

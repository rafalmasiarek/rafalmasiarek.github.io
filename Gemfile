source "https://rubygems.org"

gem "jekyll", github: "jekyll/jekyll"

group :jekyll_plugins do
  gem "jekyll-last-modified-at"
  gem "jekyll-sitemap"
  gem "jekyll-assets"
  gem 'jekyll-paginate-v2'
end

# tzinfo is used by Jekyll's own timezone: config option and by
# _plugins/legal_versions.rb to normalise legal-document dates. Windows
# and JRuby do not include system zoneinfo files, so tzinfo-data is
# bundled unconditionally to keep zone data available on every platform.
gem "tzinfo", "~> 2.0"
gem "tzinfo-data"

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.2.0", :install_if => Gem.win_platform?


source "https://rubygems.org"

gem "jekyll", github: "jekyll/jekyll"

group :jekyll_plugins do
  gem "jekyll-last-modified-at"
  gem "jekyll-sitemap"
  gem "jekyll-assets"
  gem 'jekyll-paginate-v2'
end

# Windows and JRuby does not include zoneinfo files, so bundle the tzinfo-data gem
# and associated library.
install_if -> { RUBY_PLATFORM =~ %r!mingw|mswin|java! } do
  gem "tzinfo", "~> 2.0"
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.2.0", :install_if => Gem.win_platform?


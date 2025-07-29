require 'net/http'
require 'json'
require 'fileutils'
require_relative 'transliteration_filter'

include SlugifyHelper

class DiscogsFetcher
  API_URL = "https://api.discogs.com/users/%{username}/collection/folders/0/releases"

  def initialize(site)
    @site = site
    @config = site.config['discogs'] || {}
    @username = @config['username'] || ENV['DISCOGS_USERNAME']
    @token = @config['token'] || ENV['DISCOGS_TOKEN']
    @vinyl_dir = File.join(site.source, "_vinyls")
    @cover_dir = File.join(site.source, "assets/vinyl_covers")

    unless @username && @token
      Jekyll.logger.warn "⚠️  DiscogsFetcher:", "Missing DISCOGS_USERNAME or DISCOGS_TOKEN"
      @skip = true
    end
  end

  def generate
    return if @skip

    Jekyll.logger.info "🎵 DiscogsFetcher:", "Fetching vinyls for #{@username}..."

    releases = fetch_releases
    releases.each do |release|
      save_release(release)
    end
  end

  def fetch_releases
    releases = []
    page = 1

    loop do
      url = "#{API_URL % { username: @username }}?token=#{@token}&page=#{page}&per_page=100"
      uri = URI(url)
      res = Net::HTTP.get_response(uri)

      unless res.is_a?(Net::HTTPSuccess)
        Jekyll.logger.error "❌ DiscogsFetcher:", "HTTP #{res.code} for #{uri}"
        Jekyll.logger.error "Response body:", res.body[0..500]
        break
      end

      data = JSON.parse(res.body)
      Jekyll.logger.info "📦 DiscogsFetcher:", "Fetched #{data["releases"].size} releases (page #{page})"
      releases += data["releases"]
      break if data["pagination"]["pages"] == page

      page += 1
    end

    releases
  end

  def save_release(release)
    id = release["id"]
    artist = release["basic_information"]["artists"].map { |a| a["name"] }.join(", ")
    title = release["basic_information"]["title"]
    year = release["basic_information"]["year"]
    thumb = release["basic_information"]["cover_image"]

    slug = translit_slugify("#{artist}-#{title}")
    md_path = File.join(@vinyl_dir, "#{slug}.md")
    jpg_path = File.join(@cover_dir, "#{slug}.jpg")
    overwrite_jpg_path = File.join(@cover_dir, "#{slug}.overwrite.jpg")
    overwrite_path = File.join(@vinyl_dir, "#{slug}.md.overwrite")

    front_matter = {
      "layout" => "vinyl",
      "discogs_id" => id,
      "title" => title,
      "artist" => artist,
      "year" => year,
      "slug" => slug,
      "cover" => "#{slug}.jpg",
    }

    if File.exist?(overwrite_jpg_path)
      if File.exist?(jpg_path)
        File.delete(jpg_path)
        Jekyll.logger.info "🗑️  Old cover deleted:", jpg_path
      end
      FileUtils.cp(overwrite_jpg_path, jpg_path, preserve: false)
      Jekyll.logger.info "🖼️  Custom cover used:", "#{overwrite_jpg_path} -> #{jpg_path}"
      front_matter["cover"] = "#{slug}.jpg"
    elsif !File.exist?(jpg_path)
      download_cover(thumb, jpg_path)
      front_matter["cover"] = thumb
    else
      Jekyll.logger.info "🖼️  Cover already exists:", jpg_path
      front_matter["cover"] ||= "#{slug}.jpg"
    end

    if File.exist?(overwrite_path)
      overwrite = File.read(overwrite_path)

      if overwrite =~ /\A---(.+?)---/m
        overwrite_yaml = YAML.safe_load($1)
        front_matter.merge!(overwrite_yaml || {})

        content_body = overwrite.sub(/\A---(.+?)---/m, '').lstrip
      else
        content_body = overwrite
      end
    else
      content_body = ""
    end

    content = "#{front_matter.to_yaml}---\n#{content_body}"

    File.write(md_path, content)
    Jekyll.logger.info "📄 Vinyl saved:", "#{slug}.md"
  end

  def download_cover(url, path)
    return unless url

    begin
      URI.open(url) do |image|
        FileUtils.mkdir_p(File.dirname(path))
        File.binwrite(path, image.read)
        Jekyll.logger.info "🖼️  Cover saved:", File.basename(path)
      end
    rescue => e
      Jekyll.logger.warn "❌ Cover download failed:", e.message
    end
  end
end

# Hook for Jekyll build
Jekyll::Hooks.register :site, :after_init do |site|
  Jekyll.logger.info "✅ DiscogsFetcher: Plugin loaded"
  fetcher = DiscogsFetcher.new(site)
  fetcher.generate
end

# frozen_string_literal: true

require "digest/md5"
require "cgi"

module Jekyll
  module AssetUrlFilter
    def asset_url(input, source_name = nil, bust_override = nil)
      site = @context.registers[:site]
      return input.to_s if site.nil?

      cfg = site.config.fetch("assets", {})
      sources = cfg.fetch("sources", {})
      default_source = cfg["default_source"] || "local"

      source_key = (source_name || default_source).to_s
      source = sources.fetch(source_key, {})

      base_url = source["base_url"].to_s.sub(%r{/*$}, "")
      prefix   = source["prefix"].to_s
      strategy = (
          source["strategy"] ||
          cfg["default_strategy"] ||
          "config_version"
      ).to_s

      bust =
        if bust_override.nil?
          source.key?("bust") ? source["bust"] : cfg.fetch("default_bust", true)
        else
          bust_override
        end

      path = normalize_path(input.to_s, prefix)
      url  = "#{base_url}#{path}"

      version =
        if bust
          resolve_version(site, cfg, strategy, path)
        else
          nil
        end

      append_version(url, version)
    end

    private

    def normalize_path(input, prefix)
      clean_input = input.to_s.strip

      return clean_input if clean_input.match?(%r{\Ahttps?://}i)

      if clean_input.start_with?("/")
        clean_input
      else
        normalized_prefix =
          if prefix.to_s.empty?
            ""
          else
            "/#{prefix}".gsub(%r{/+}, "/").sub(%r{/$}, "")
          end

        "#{normalized_prefix}/#{clean_input}".gsub(%r{/+}, "/")
      end
    end

    def resolve_version(site, cfg, strategy, path)
      case strategy
      when "file_hash"
        file_hash_version(site, path, cfg)
      when "config_version"
        config_version(site, cfg)
      when "build_timestamp"
        build_timestamp(site, cfg)
      when "none"
        nil
      else
        config_version(site, cfg)
      end
    end

    def config_version(site, cfg)
      build_version = site.config.dig("asset_build", "version").to_s.strip
      return build_version unless build_version.empty?

      fallback = cfg["version"].to_s.strip
      return fallback unless fallback.empty?

      nil
    end

    def file_hash_version(site, public_path, cfg)
      relative_path = public_path.sub(%r{\A/}, "")
      file_path = File.join(site.source, relative_path)

      if File.file?(file_path)
        Digest::MD5.file(file_path).hexdigest
      else
        config_version(site, cfg)
      end
    rescue StandardError
      config_version(site, cfg)
    end

    def build_timestamp(site, cfg)
      configured_timestamp = site.config.dig("asset_build", "timestamp").to_s.strip
      return configured_timestamp unless configured_timestamp.empty?

      site.config["__asset_build_timestamp"] ||= begin
        now = Time.now.utc
        format("%d%06d", now.to_i, now.usec)
      end
    rescue StandardError
      config_version(site, cfg)
    end

    def append_version(url, version)
      return url if version.nil? || version.empty?

      separator = url.include?("?") ? "&" : "?"
      "#{url}#{separator}v=#{CGI.escape(version)}"
    end
  end
end

Liquid::Template.register_filter(Jekyll::AssetUrlFilter)

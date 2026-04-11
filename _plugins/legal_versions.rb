# frozen_string_literal: true

require "yaml"
require "time"
require "date"
require "pathname"
require "rubygems/version"
require "English"

module Jekyll
  module LegalVersions
    module_function

    DEFAULT_CONFIG = {
      "root" => "legal",
      "changelog_layout" => "legal-changelog",
      "changelog_entry_include" => "",
      "git_support" => false,
      "git_commit_url_template" => ""
    }.freeze

    def config(site)
      DEFAULT_CONFIG.merge(site.config["legal_versions"] || {})
    end

    def root_dir(site)
      File.join(site.source, config(site)["root"])
    end

    def legal_source_path(site, ref)
      File.join(root_dir(site), "#{ref}.md")
    end

    def parse_file(path)
      raw = File.read(path, encoding: "utf-8")

      unless raw.start_with?("---")
        return { "data" => {}, "content" => raw }
      end

      match = raw.match(/\A---\s*\n(.*?)\n---\s*\n/m)
      unless match
        return { "data" => {}, "content" => raw }
      end

      yaml_part = match[1]
      content_part = raw.sub(match[0], "")

      data = YAML.safe_load(
        yaml_part,
        permitted_classes: [Time, Date],
        permitted_symbols: [],
        aliases: true
      ) || {}

      data = {} unless data.is_a?(Hash)

      { "data" => data, "content" => content_part }
    end

    # Zwraca:
    # - ""   dla {% legal %}
    # - "en/1.0" dla {% legal en/1.0 %}
    # - nil gdy tagu brak
    def find_legal_ref_in_content(content)
      return nil if content.to_s.empty?

      match = content.match(/\{%\s*legal(?:\s+([^\s%]+))?\s*%\}/)
      return nil unless match

      match[1].to_s.strip
    end

    def version_from_ref(ref)
      File.basename(ref.to_s, ".md")
    end

    def version_anchor_id(version)
      normalized = version.to_s.strip.gsub(/[^0-9A-Za-z._-]+/, "-").tr(".", "-")
      "version-#{normalized}"
    end

    def build_changelog_url(page_url)
      url = page_url.to_s
      url = "/#{url}" unless url.start_with?("/")
      url = "#{url}/" unless url.end_with?("/")
      "#{url}changes/"
    end

    def normalize_changes(value)
      case value
      when Array
        value.map(&:to_s).map(&:strip).reject(&:empty?)
      when String
        value.strip.empty? ? [] : [value.strip]
      else
        []
      end
    end

    def git_enabled?(site)
      !!config(site)["git_support"]
    end

    def published?(data)
      return true unless data.is_a?(Hash)
      return true unless data.key?("published")

      data["published"] == true
    end

    def version_sort_key(version)
      Gem::Version.new(version.to_s.strip)
    rescue
      Gem::Version.new("0")
    end

    def git_history_for_file(site, absolute_path)
      repo_root = site.source
      relative_path = Pathname.new(absolute_path).relative_path_from(Pathname.new(repo_root)).to_s

      format = [
        "%H",
        "%h",
        "%aI",
        "%an",
        "%s",
        "%b"
      ].join("%x1f") + "%x1e"

      cmd = [
        "git",
        "-C", repo_root,
        "log",
        "--follow",
        "--date=iso-strict",
        "--format=#{format}",
        "--",
        relative_path
      ]

      output = IO.popen(cmd, err: [:child, :out], &:read)
      raise "git command failed" unless $CHILD_STATUS.success?

      output.split("\x1e").filter_map do |entry|
        next if entry.strip.empty?

        parts = entry.split("\x1f", 6)
        next unless parts.size == 6

        full_hash, short_hash, iso_date, author, subject, body = parts

        {
          "hash" => full_hash.to_s.strip,
          "short_hash" => short_hash.to_s.strip,
          "date" => Time.parse(iso_date.to_s.strip),
          "author" => author.to_s.strip,
          "subject" => subject.to_s.strip,
          "body" => body.to_s.strip
        }
      end.sort_by { |item| item["date"] }.reverse
    rescue => e
      Jekyll.logger.warn "legal_versions:", "Could not read git history for #{relative_path}: #{e.message}"
      []
    end

    def resolve_date(site, front_matter_data, source_path)
      raw_date = front_matter_data["date"]

      return raw_date if raw_date.is_a?(Time)
      return Time.parse(raw_date.to_s) if raw_date && !raw_date.to_s.strip.empty?

      git_last_commit = git_history_for_file(site, source_path).first
      return git_last_commit["date"] if git_last_commit && git_last_commit["date"].is_a?(Time)

      File.mtime(source_path)
    rescue
      File.mtime(source_path)
    end

    def compact_git_commit(site, source_path)
      commit = git_history_for_file(site, source_path).first
      return {} unless commit.is_a?(Hash)

      result = {
        "git_commit" => commit["hash"],
        "git_commit_short" => commit["short_hash"],
        "git_commit_author" => commit["author"],
        "git_commit_date" => commit["date"]
      }

      template = config(site)["git_commit_url_template"].to_s.strip
      if !template.empty? && !commit["hash"].to_s.empty?
        result["git_commit_url"] = begin
          template % { commit: commit["hash"] }
        rescue
          nil
        end
      end

      result
    end

    def relative_path_from_root(site, absolute_path)
      Pathname.new(absolute_path).relative_path_from(Pathname.new(root_dir(site))).to_s
    end

    def ref_from_absolute_path(site, absolute_path)
      relative = relative_path_from_root(site, absolute_path)
      relative.sub(/\.md\z/, "")
    end

    def latest_public_ref(site, page)
      scope_root = page.data["legal_path"].to_s.strip
      search_root =
        if scope_root.empty?
          root_dir(site)
        else
          File.join(root_dir(site), scope_root)
        end

      unless Dir.exist?(search_root)
        raise "Legal search path does not exist for #{page.path}: #{search_root}"
      end

      files = Dir.glob(File.join(search_root, "**", "*.md")).sort

      public_candidates = files.filter_map do |path|
        parsed = parse_file(path)
        data = parsed["data"]
        next unless published?(data)

        version = data["version"].to_s.strip
        version = File.basename(path, ".md") if version.empty?

        {
          "path" => path,
          "ref" => ref_from_absolute_path(site, path),
          "version" => version,
          "date" => resolve_date(site, data, path)
        }
      rescue => e
        raise "Failed to parse legal file #{path}: #{e.class}: #{e.message}"
      end

      if public_candidates.empty?
        if scope_root.empty?
          raise "No published legal versions found under #{search_root} referenced from #{page.path}"
        else
          raise "No published legal versions found under #{search_root} (legal_path=#{scope_root.inspect}) referenced from #{page.path}"
        end
      end

      public_candidates.max_by do |item|
        [version_sort_key(item["version"]), item["date"] || Time.at(0)]
      end["ref"]
    end

    def ensure_public_ref!(site, page, ref)
      source_path = legal_source_path(site, ref)

      unless File.exist?(source_path)
        raise "Missing legal file #{source_path} referenced from #{page.path}"
      end

      parsed = parse_file(source_path)
      data = parsed["data"]

      unless published?(data)
        raise "Non-public legal file #{source_path} referenced from #{page.path}"
      end

      ref
    end

    def resolved_ref_for_page(site, page)
      raw_ref = page.data["legal_ref"].to_s.strip

      if raw_ref.empty?
        latest_public_ref(site, page)
      else
        ensure_public_ref!(site, page, raw_ref)
      end
    end

    def changelog_scope_dir(site, ref, page)
      raw_ref = page.data["legal_ref"].to_s.strip

      if raw_ref.empty?
        scope_root = page.data["legal_path"].to_s.strip
        if scope_root.empty?
          root_dir(site)
        else
          File.join(root_dir(site), scope_root)
        end
      else
        File.dirname(legal_source_path(site, ref))
      end
    end

    def build_changelog_entries(site, ref, page)
      dir = changelog_scope_dir(site, ref, page)
      files = Dir.glob(File.join(dir, "**", "*.md")).sort

      entries = files.map do |path|
        parsed = parse_file(path)
        data = parsed["data"]

        next unless published?(data)

        version = data["version"].to_s.strip
        version = File.basename(path, ".md") if version.empty?

        entry = {
          "version" => version,
          "date" => resolve_date(site, data, path),
          "summary" => data["summary"].to_s.strip,
          "changes" => normalize_changes(data["changes"]),
          "anchor_id" => version_anchor_id(version),
          "path" => Pathname.new(path).relative_path_from(Pathname.new(site.source)).to_s
        }

        entry.merge!(compact_git_commit(site, path)) if git_enabled?(site)
        entry
      rescue => e
        raise "Failed to parse legal file #{path}: #{e.class}: #{e.message}"
      end.compact

      entries.sort_by do |entry|
        [version_sort_key(entry["version"]), entry["date"] || Time.at(0)]
      end.reverse
    end

    def legal_data_for_page(site, page)
      resolved_ref = resolved_ref_for_page(site, page)
      source_path = legal_source_path(site, resolved_ref)

      parsed = parse_file(source_path)
      data = parsed["data"]

      version = data["version"].to_s.strip
      version = version_from_ref(resolved_ref) if version.empty?

      result = {
        "legal_ref" => resolved_ref,
        "legal_source_path" => Pathname.new(source_path).relative_path_from(Pathname.new(site.source)).to_s,
        "legal_current_version" => version,
        "legal_last_modified_at" => resolve_date(site, data, source_path),
        "legal_current_summary" => data["summary"].to_s.strip,
        "legal_current_changes" => normalize_changes(data["changes"]),
        "legal_changelog_url" => build_changelog_url(page.url),
        "legal_current_anchor_id" => version_anchor_id(version),
        "legal_changelog_entry_include" => config(site)["changelog_entry_include"].to_s.strip
      }

      result["legal_last_changes_url"] = "#{result["legal_changelog_url"]}##{result["legal_current_anchor_id"]}"
      result["legal_changelog"] = build_changelog_entries(site, resolved_ref, page)

      if git_enabled?(site)
        result["legal_last_modified_commit"] = compact_git_commit(site, source_path)
      end

      result
    end
  end

  class LegalTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @raw_ref = markup.to_s.strip
    end

    def render(context)
      site = context.registers[:site]
      page = context.registers[:page]

      resolved_ref =
        if @raw_ref.empty?
          page["legal_ref"].to_s.strip
        else
          @raw_ref
        end

      if resolved_ref.empty?
        raise "Could not resolve legal reference for page #{page['path'] || page['url'] || 'unknown'}"
      end

      source_path = LegalVersions.legal_source_path(site, resolved_ref)

      unless File.exist?(source_path)
        raise "Missing legal file #{source_path} referenced from #{page['path'] || page['url'] || 'unknown'}"
      end

      parsed = LegalVersions.parse_file(source_path)
      data = parsed["data"]

      unless LegalVersions.published?(data)
        raise "Non-public legal file #{source_path} referenced from #{page['path'] || page['url'] || 'unknown'}"
      end

      page["legal_ref"] = resolved_ref if page.respond_to?(:[]=)

      parsed["content"].to_s
    end
  end

  class LegalGeneratedChangelogPage < PageWithoutAFile
    def initialize(site, base, dir, data = {})
      @site = site
      @base = base
      @dir = dir
      @name = "index.html"

      process(@name)
      self.content = ""
      self.data = data
    end
  end

  class LegalChangelogGenerator < Generator
    safe true
    priority :low

    def generate(site)
      site.pages.each do |page|
        ref = page.data["legal_ref"].to_s.strip
        next if ref.empty?

        changelog_url = page.data["legal_changelog_url"].to_s
        next if changelog_url.empty?

        dir = changelog_url.sub(%r!\A/!, "").sub(%r!/\z!, "")

        generated = LegalGeneratedChangelogPage.new(
          site,
          site.source,
          dir,
          {
            "layout" => LegalVersions.config(site)["changelog_layout"],
            "title" => page.data["title"],
            "lang" => page.data["lang"],
            "permalink" => changelog_url,
            "legal_ref" => page.data["legal_ref"],
            "legal_current_version" => page.data["legal_current_version"],
            "legal_last_modified_at" => page.data["legal_last_modified_at"],
            "legal_last_modified_commit" => page.data["legal_last_modified_commit"],
            "legal_changelog" => page.data["legal_changelog"],
            "legal_changelog_url" => page.data["legal_changelog_url"],
            "legal_last_changes_url" => page.data["legal_last_changes_url"],
            "legal_parent_url" => page.url,
            "legal_parent_title" => page.data["title"],
            "legal_git_support" => LegalVersions.git_enabled?(site),
            "legal_changelog_entry_include" => page.data["legal_changelog_entry_include"]
          }
        )

        site.pages << generated
      end
    end
  end
end

Liquid::Template.register_tag("legal", Jekyll::LegalTag)

Jekyll::Hooks.register [:pages], :pre_render do |page, _payload|
  site = page.site
  raw_ref = Jekyll::LegalVersions.find_legal_ref_in_content(page.content)
  next if raw_ref.nil?

  # "" oznacza {% legal %} bez argumentu
  page.data["legal_ref"] = raw_ref

  data = Jekyll::LegalVersions.legal_data_for_page(site, page)
  data.each do |key, value|
    page.data[key] = value
  end
end
# frozen_string_literal: true
require 'json'
require 'net/http'
require 'uri'

module Jekyll
  class LicensesTableTag < Liquid::Tag
    API_URL = "https://masiarek.pl/api/v1/licenses"

    def render(context)
      build_html(licenses(context))
    end

    protected

    def licenses(context)
      site = context.registers[:site]
      licenses = []
      licenses += parse_gemfile(File.join(site.source, "Gemfile.lock"))
      licenses += fetch_api(API_URL)
      licenses += (site.config["licenses"] || [])
      licenses.uniq! { |p| p["name"] }

      licenses.each do |pkg|
        if pkg["source"] == "Ruby gem" && (pkg["license"].nil? || pkg["license"] == "unknown")
          pkg["license"] = fetch_rubygems_license(pkg["name"])
        end
      end

      licenses
    end

    private

    def parse_gemfile(path)
      return [] unless File.exist?(path)
      gems = []
      File.readlines(path).each do |line|
        if line =~ /^\s{4}([a-zA-Z0-9_\-]+) \(([\d\.]+)\)/
          name, version = $1, $2
          gems << {
            "name" => name,
            "version" => version,
            "license" => "unknown",
            "homepage" => "https://rubygems.org/gems/#{name}",
            "source" => "Ruby gem"
          }
        end
      end
      gems
    end

    def fetch_api(url)
      uri = URI.parse(url)
      res = Net::HTTP.get_response(uri)
      return [] unless res.is_a?(Net::HTTPSuccess)
      json = JSON.parse(res.body)
      json["data"]["packages"].map do |pkg|
        {
          "name" => pkg["name"],
          "version" => pkg["version"],
          "license" => (pkg["license"] || []).join(", "),
          "homepage" => pkg["homepage"],
          "source" => "API"
        }
      end
    rescue
      []
    end

    def fetch_rubygems_license(name)
      uri = URI.parse("https://rubygems.org/api/v1/gems/#{name}.json")
      res = Net::HTTP.get_response(uri)
      return "unknown" unless res.is_a?(Net::HTTPSuccess)
      json = JSON.parse(res.body)
      licenses = Array(json["licenses"]).reject(&:empty?)
      licenses.any? ? licenses.join(", ") : "unknown"
    rescue
      "unknown"
    end

    def build_html(licenses)
      rows = licenses.map do |pkg|
        name       = pkg["name"]
        version    = pkg["version"]
        license    = pkg["license"] || "unknown"
        homepage   = pkg["homepage"]
        source_url = pkg["source_url"]
        source     = pkg["source"] || "unknown"

        link = [homepage, source_url].find { |u| u && !u.to_s.strip.empty? }
    
        name_html = if link
          "<a href='#{link}' target='_blank' rel='noopener'>#{name} <span class='external-link-arrow'>↗</span></a>"
        else
          name
        end
    
        "<tr><td class='pkg-name'>#{name_html}</td><td>#{version}</td><td>#{license}</td><td>#{source}</td></tr>"
      end.join("\n")
    
      <<~HTML
        <table class="licenses-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Version</th>
              <th>License</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            #{rows}
          </tbody>
        </table>
      HTML
    end
  end

  class LicensesMarkdownTag < LicensesTableTag
    def render(context)
      build_markdown(licenses(context))
    end

    private

    def build_markdown(licenses)
      rows = licenses.map do |pkg|
        link = [pkg["homepage"], pkg["source_url"]].find { |url| url && !url.to_s.strip.empty? }
        name = link ? "[#{markdown_cell(pkg["name"])}](#{link})" : markdown_cell(pkg["name"])

        [
          name,
          markdown_cell(pkg["version"]),
          markdown_cell(pkg["license"] || "unknown"),
          markdown_cell(pkg["source"] || "unknown")
        ].join(" | ")
      end

      [
        "| Name | Version | License | Source |",
        "| --- | --- | --- | --- |",
        *rows.map { |row| "| #{row} |" }
      ].join("\n")
    end

    def markdown_cell(value)
      value.to_s.gsub(/[\r\n]+/, " ").gsub("|", "\\|")
    end
  end
end

Liquid::Template.register_tag('licenses_table', Jekyll::LicensesTableTag)
Liquid::Template.register_tag('licenses_markdown', Jekyll::LicensesMarkdownTag)

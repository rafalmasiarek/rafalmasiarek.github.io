# frozen_string_literal: true

module Jekyll
  class RobotsTxtPage < Page
    def initialize(site, content)
      @site = site
      @base = site.source
      @dir  = "/"
      @name = "robots.txt"

      process(@name)
      self.data = {}
      self.content = content
    end

    def render(*)
      # robots.txt bez layoutu
    end
  end

  class RobotsGenerator < Generator
    safe true
    priority :low

    def generate(site)
      cfg = site.config["robots"] || {}
      return unless cfg["enabled"]

      site.pages << RobotsTxtPage.new(site, build_robots_txt(site, cfg))
    end

    private

    def build_robots_txt(site, cfg)
      lines = [
        "#    .__________________________.",
        "#    | .___________________. |==|",
        "#    | | ................. | |  |",
        "#    | | ::[ Dear robot ]: | |  |",
        "#    | | ::::[ be nice ]:: | |  |",
        "#    | | ::::::::::::::::: | |  |",
        "#    | | ::::::::::::::::: | |  |",
        "#    | | ::::::::::::::::: | |  |",
        "#    | | ::::::::::::::::: | | ,|",
        "#    | !___________________! |(c|",
        "#    !_______________________!__!",
        "#   /                            \\",
        "#  /  [][][][][][][][][][][][][]  \\",
        "# /  [][][][][][][][][][][][][][]  \\",
        "#(  [][][][][____________][][][][]  )",
        "# \\ ------------------------------ /",
        "#  \\______________________________/",
        ""
      ]

      if cfg["block_ai"] == true
        lines << "# Bots, crawlers, spiders, scanners, scrapers, AI agents, LLMs, and other"
        lines << "# automated systems are not permitted to access, scan, collect, extract, index,"
        lines << "# retain, analyse, train on, or otherwise use Website Content or Personal"
        lines << "# Information without prior written consent."
        lines << "#"
        lines << "# This notice, the Terms and Conditions, and Content Signals are an express"
        lines << "# reservation of rights by the rightholder under Article 4(3) of Directive (EU)"
        lines << "# 2019/790 on copyright and related rights in the Digital Single Market."
        lines << "# Directive (EU) 2019/790: https://eur-lex.europa.eu/eli/dir/2019/790/oj"
        lines << "# Access to the permitted policy documents does not grant consent for any other use."
      end

      custom_block = cfg["custom_block"].to_s.strip
      unless custom_block.empty?
        lines.concat(custom_block.lines(chomp: true))
        lines << ""
      end

      lines << "User-agent: #{cfg["user_agent"] || "*"}"

      if cfg["block_ai"] == true
        lines << "Content-signal: search=no, ai-input=no, ai-train=no, use=immediate"
      end

      disallow = Array(cfg["disallow"])
      allow    = Array(cfg["allow"])

      if disallow.empty?
        lines << "Disallow:"
      else
        disallow.each { |path| lines << "Disallow: #{path}" }
      end

      allow.each { |path| lines << "Allow: #{path}" }

      sitemap = cfg["sitemap"]
      sitemap = default_sitemap(site) if sitemap.nil? || sitemap.to_s.strip.empty?
      lines << "Sitemap: #{sitemap}" unless sitemap.to_s.strip.empty?

      lines.join("\n") + "\n"
    end

    def default_sitemap(site)
      url = site.config["url"].to_s.sub(%r{/+\z}, "")
      baseurl = site.config["baseurl"].to_s.strip

      baseurl = "" if baseurl == "/"
      baseurl = "" if baseurl.empty?
      baseurl = "/#{baseurl}" unless baseurl.empty? || baseurl.start_with?("/")
      baseurl = baseurl.sub(%r{/+\z}, "")

      return "" if url.empty?

      "#{url}#{baseurl}/sitemap.xml"
    end

  end

  class RobotsMetaTag < Liquid::Tag
    def render(context)
      site = context.registers[:site]
      cfg  = site.config["robots"] || {}

      return "" unless cfg["enabled"]

      directives = []
      directives << (cfg.fetch("index", true) ? "index" : "noindex")
      directives << (cfg.fetch("follow", true) ? "follow" : "nofollow")
      directives << "noarchive" if cfg["noarchive"]
      directives << "nosnippet" if cfg["nosnippet"]
      directives << "noimageindex" if cfg["noimageindex"]
      if cfg["block_ai"] == true
        directives << "noai"
        directives << "noimageai"
      end

      %(<meta name="robots" content="#{directives.join(', ')}">)
    end
  end
end

Liquid::Template.register_tag("robots_meta", Jekyll::RobotsMetaTag)

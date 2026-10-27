# frozen_string_literal: true
require 'net/http'
require 'uri'

module Jekyll
  class IconTag < Liquid::Tag
    BASE_URL = "https://masiarek.pl/assets/img/icons"

    @@cache = {}

    def initialize(tag_name, markup, tokens)
      super
      @markup = markup.strip
    end

    def render(context)
      name = resolve_name(context)
      return "" if name.nil? || name.empty?

      fetch_icon(name)
    end

    private

    def resolve_name(context)
      if @markup =~ /\A(["'])(.*)\1\z/
        $2
      else
        context[@markup].to_s
      end
    end

    def fetch_icon(name)
      return @@cache[name] if @@cache.key?(name)

      uri = URI.parse("#{BASE_URL}/#{name}.svg")
      res = Net::HTTP.get_response(uri)
      @@cache[name] = res.is_a?(Net::HTTPSuccess) ? normalize(res.body) : ""
    rescue
      @@cache[name] = ""
    end

    def normalize(svg)
      svg
        .sub(/\s+width="\d+"\s+height="\d+"/, '')
        .sub(/class="bi bi-[\w-]+"/, 'class="icon"')
    end
  end
end

Liquid::Template.register_tag('icon', Jekyll::IconTag)

# transliteration_filter.rb
require 'i18n'
I18n.config.available_locales = :en

module SlugifyHelper
  def translit_slugify(input)
    I18n.transliterate(input.to_s)
        .downcase
        .gsub(/[^a-z0-9]+/, '-')
        .gsub(/-{2,}/, '-')
        .gsub(/^-|-$/, '')
  end
end

# Liquid filter
Liquid::Template.register_filter(SlugifyHelper)

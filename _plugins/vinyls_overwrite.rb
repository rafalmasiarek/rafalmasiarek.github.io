module Jekyll
  class VinylsOverwrite < Generator
    priority :low

    def generate(site)
      vinyls = site.collections['vinyls']&.docs || []

      vinyls.each do |doc|
        overwrite_path = doc.path + '.overwrite'
        next unless File.exist?(overwrite_path)

        begin
          raw = File.read(overwrite_path)

          if raw =~ /\A---\s*\n(.+?)\n---\s*\n?(.*)/m
            front_matter = Regexp.last_match(1)
            body = Regexp.last_match(2)

            overwrite_data = SafeYAML.load(front_matter)
            if overwrite_data.is_a?(Hash)
              doc.data.merge!(overwrite_data)
              Jekyll.logger.info "🔁 Overwrite front matter for:", doc.basename
            end

            if body && !body.strip.empty?
              doc.content = body
              Jekyll.logger.info "✏️ Overwrite content for:", doc.basename
            end
          else
            Jekyll.logger.warn "⚠️ Invalid overwrite format:", File.basename(overwrite_path)
          end

        rescue => e
          Jekyll.logger.error "❌ Error in overwrite for #{doc.basename}:", e.message
        end
      end
    end
  end
end

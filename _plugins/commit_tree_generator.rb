module Jekyll
  class CommitTreeGenerator < Generator
    safe true
    priority :low

    def generate(site)
      repo_url = site.config['github_repo'] || "https://github.com/user/repo"
      output_path = File.join(site.source, "_includes", "commit_tree.md")

      log_output = `git log --graph --pretty=format:'%h|||%d|||%an|||%ad|||%s' --date=short`
      lines = [""]

      log_output.each_line do |line|
        parts = line.gsub(/^[\|\*\s]+/, '').strip.split("|||", 5)
        next unless parts.size == 5

        hash, ref, author, date, subject = parts

        refnames = ref.to_s.strip.gsub(/^[()]*/, '').gsub(/[()]*/, '')
        md_line = %Q{* <a href="#{repo_url}/commit/#{hash.strip}" target="_blank">#{subject.strip}</a> — #{author.strip}, #{date.strip}}
        md_line += " `#{refnames}`" unless refnames.empty?

        lines << md_line
      end

      File.write(output_path, lines.join("\n"))
      puts "✔ Generated commit_tree.md with #{lines.size - 2} commits."
    end
  end
end

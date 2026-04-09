class EraCalculator
  CURRENT_YEAR = 2026

  GENRE_MAP = {
    "indie rock" => ["alternative rock", "indie pop", "modern rock"],
    "indie pop" => ["indie rock", "alternative pop", "dream pop"],
    "alternative rock" => ["indie rock", "modern rock", "rock"],
    "pop" => ["dance pop", "electropop", "alternative pop"],
    "hip hop" => ["rap", "trap", "underground hip hop"],
    "electronic" => ["electro", "edm", "house"],
    "r&b" => ["neo soul", "alternative r&b", "soul"]
  }.freeze

  def self.calculate_era_ranges(birth_year)
    [
      {
        name: "formative",
        year_range: "#{birth_year + 10}-#{birth_year + 12}",
        age_range: "10-12",
        years: [birth_year + 10, birth_year + 12]
      },
      {
        name: "high_school",
        year_range: "#{birth_year + 14}-#{birth_year + 18}",
        age_range: "14-18",
        years: [birth_year + 14, birth_year + 18]
      },
      {
        name: "college",
        year_range: "#{birth_year + 18}-#{birth_year + 22}",
        age_range: "18-22",
        years: [birth_year + 18, birth_year + 22]
      },
      {
        name: "recent",
        year_range: "2023-2025",
        age_range: "recent",
        years: [2023, 2025]
      },
      {
        name: "current",
        year_range: CURRENT_YEAR.to_s,
        age_range: "current",
        years: [CURRENT_YEAR, CURRENT_YEAR]
      }
    ]
  end

  def self.distribute_era_track_count(target_count)
    formative_count = (target_count * 0.30).floor
    current_count = [(target_count * 0.10).floor, 3].max

    remaining = target_count - formative_count - current_count
    per_middle_era = remaining / 3
    remainder = remaining - (per_middle_era * 3)

    {
      formative: formative_count + remainder,
      high_school: per_middle_era,
      college: per_middle_era,
      recent: per_middle_era,
      current: current_count
    }
  end

  def self.extract_genres(ranked_artists, limit = 50)
    ranked_artists.first(limit)
      .flat_map { |artist| artist["genres"] || [] }
      .uniq
  end

  def self.expand_genres(user_genres)
    expanded = Set.new(user_genres)

    user_genres.each do |genre|
      related = GENRE_MAP[genre.downcase]
      related&.each { |g| expanded.add(g) }
    end

    expanded.to_a
  end
end

require "rails_helper"

RSpec.describe EraCalculator do
  describe ".calculate_era_ranges" do
    it "calculates correct ranges for birth year 1991" do
      ranges = described_class.calculate_era_ranges(1991)

      expect(ranges).to contain_exactly(
        { name: "formative", year_range: "2001-2003", age_range: "10-12", years: [2001, 2003] },
        { name: "high_school", year_range: "2005-2009", age_range: "14-18", years: [2005, 2009] },
        { name: "college", year_range: "2009-2013", age_range: "18-22", years: [2009, 2013] },
        { name: "recent", year_range: "2023-2025", age_range: "recent", years: [2023, 2025] },
        { name: "current", year_range: "2026", age_range: "current", years: [2026, 2026] }
      )
    end

    it "calculates correct ranges for birth year 1985" do
      ranges = described_class.calculate_era_ranges(1985)

      expect(ranges[0][:year_range]).to eq("1995-1997")
      expect(ranges[1][:year_range]).to eq("1999-2003")
      expect(ranges[2][:year_range]).to eq("2003-2007")
    end

    it "always includes recent and current eras regardless of birth year" do
      ranges = described_class.calculate_era_ranges(2000)

      recent = ranges.find { |r| r[:name] == "recent" }
      current = ranges.find { |r| r[:name] == "current" }

      expect(recent[:years]).to eq([2023, 2025])
      expect(current[:years]).to eq([2026, 2026])
    end

    it "returns exactly 5 eras" do
      ranges = described_class.calculate_era_ranges(1991)
      expect(ranges.length).to eq(5)
    end
  end

  describe ".distribute_era_track_count" do
    it "distributes 51 tracks with formative priority" do
      distribution = described_class.distribute_era_track_count(51)

      expect(distribution[:formative]).to be >= 15
      expect(distribution[:current]).to be >= 3
      total = distribution.values.sum
      expect(total).to eq(51)
    end

    it "distributes 36 tracks correctly" do
      distribution = described_class.distribute_era_track_count(36)

      expect(distribution[:formative]).to be >= 10
      expect(distribution[:high_school]).to be >= 6
      expect(distribution[:college]).to be >= 6
      expect(distribution[:recent]).to be >= 6
      expect(distribution[:current]).to be >= 3

      total = distribution.values.sum
      expect(total).to eq(36)
    end

    it "handles smaller track counts" do
      distribution = described_class.distribute_era_track_count(15)

      total = distribution.values.sum
      expect(total).to eq(15)
      expect(distribution[:formative]).to be > 0
    end

    it "gives formative the highest allocation" do
      distribution = described_class.distribute_era_track_count(51)

      expect(distribution[:formative]).to be > distribution[:high_school]
      expect(distribution[:formative]).to be > distribution[:college]
      expect(distribution[:formative]).to be > distribution[:recent]
      expect(distribution[:formative]).to be > distribution[:current]
    end

    it "distributes middle eras evenly" do
      distribution = described_class.distribute_era_track_count(51)

      expect(distribution[:high_school]).to eq(distribution[:college])
      expect(distribution[:college]).to eq(distribution[:recent])
    end
  end

  describe ".extract_genres" do
    it "extracts unique genres from ranked artists" do
      artists = [
        { "genres" => ["pop", "dance pop"] },
        { "genres" => ["pop", "rock"] },
        { "genres" => ["indie rock"] }
      ]

      genres = described_class.extract_genres(artists, 50)
      expect(genres).to contain_exactly("pop", "dance pop", "rock", "indie rock")
    end

    it "limits to top N artists" do
      artists = Array.new(60) { |i| { "genres" => ["genre_#{i}"] } }

      genres = described_class.extract_genres(artists, 10)
      expect(genres.length).to eq(10)
    end

    it "handles artists without genres" do
      artists = [
        { "genres" => ["pop"] },
        { "name" => "No Genres Artist" },
        { "genres" => nil }
      ]

      genres = described_class.extract_genres(artists, 50)
      expect(genres).to eq(["pop"])
    end

    it "returns empty array when no artists provided" do
      genres = described_class.extract_genres([], 50)
      expect(genres).to eq([])
    end
  end

  describe ".expand_genres" do
    it "expands known genres to include related genres" do
      user_genres = ["indie rock", "pop"]
      expanded = described_class.expand_genres(user_genres)

      expect(expanded).to include("indie rock", "pop")
      expect(expanded).to include("alternative rock", "indie pop", "modern rock")
      expect(expanded).to include("dance pop", "electropop", "alternative pop")
    end

    it "preserves unknown genres without expansion" do
      user_genres = ["obscure genre"]
      expanded = described_class.expand_genres(user_genres)

      expect(expanded).to include("obscure genre")
    end

    it "handles case-insensitive genre matching" do
      user_genres = ["Pop"]
      expanded = described_class.expand_genres(user_genres)

      expect(expanded).to include("Pop")
      expect(expanded).to include("dance pop", "electropop", "alternative pop")
    end

    it "does not produce duplicates" do
      user_genres = ["indie rock", "indie pop"]
      expanded = described_class.expand_genres(user_genres)

      expect(expanded.length).to eq(expanded.uniq.length)
    end

    it "returns empty array for empty input" do
      expanded = described_class.expand_genres([])
      expect(expanded).to eq([])
    end
  end
end

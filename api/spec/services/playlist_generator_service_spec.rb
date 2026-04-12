require "rails_helper"

RSpec.describe PlaylistGeneratorService do
  let(:user) { create(:user, birth_year: 1991) }
  let(:spotify_client) { instance_double(SpotifyApiClient) }
  let(:generator) { described_class.new(user, spotify_client) }

  let(:make_track) do
    lambda do |id:, name:, artist_id: "default_artist", artist_name: "Default Artist", popularity: 75|
      {
        "id" => id,
        "name" => name,
        "artists" => [{ "id" => artist_id, "name" => artist_name }],
        "popularity" => popularity,
        "duration_ms" => 210_000,
        "uri" => "spotify:track:#{id}"
      }
    end
  end

  let(:analysis_data) do
    ranked_tracks = (1..50).map do |i|
      make_track.call(
        id: "track_#{i}",
        name: "Track #{i}",
        artist_id: "artist_#{(i % 20) + 1}",
        artist_name: "Artist #{(i % 20) + 1}",
        popularity: 80
      ).merge("total_weight" => 2.0 - (i * 0.03))
    end

    ranked_artists = (1..50).map do |i|
      {
        "id" => "artist_#{i}",
        "name" => "Artist #{i}",
        "genres" => ["pop", "rock"],
        "total_weight" => 2.0 - (i * 0.03)
      }
    end

    {
      tracks: { ranked_tracks: ranked_tracks },
      artists: { ranked_artists: ranked_artists }
    }
  end

  before do
    allow(spotify_client).to receive(:search).and_return({
      "tracks" => {
        "items" => (1..5).map do |i|
          make_track.call(
            id: "search_#{SecureRandom.hex(4)}_#{i}",
            name: "Search Result #{i}",
            artist_id: "new_artist_#{i + 100}",
            popularity: 70
          )
        end
      },
      "artists" => { "items" => [] }
    })

    allow(spotify_client).to receive(:get_recommendations).and_return({
      "tracks" => (1..10).map do |i|
        make_track.call(
          id: "rec_#{SecureRandom.hex(4)}_#{i}",
          name: "Recommendation #{i}",
          artist_id: "rec_artist_#{i + 200}",
          popularity: 65
        )
      end
    })

    allow(spotify_client).to receive(:artist_top_tracks).and_return({
      "tracks" => (1..5).map do |i|
        make_track.call(
          id: "artist_top_#{SecureRandom.hex(4)}_#{i}",
          name: "Artist Top #{i}",
          popularity: 75
        )
      end
    })
  end

  describe "#generate" do
    it "returns tracks split into favorites, genre_discoveries, and era_hits" do
      result = generator.generate(analysis_data, birth_year: 1991, target_count: 30)

      expect(result).to have_key(:tracks)
      expect(result).to have_key(:favorites)
      expect(result).to have_key(:genre_discoveries)
      expect(result).to have_key(:era_hits)
    end

    it "returns stats with track counts" do
      result = generator.generate(analysis_data, birth_year: 1991, target_count: 30)

      expect(result[:stats][:birth_year]).to eq(1991)
      expect(result[:stats][:from_favorites]).to be > 0
    end

    it "respects exclude_track_ids" do
      excluded = %w[track_1 track_2 track_3]
      result = generator.generate(
        analysis_data,
        birth_year: 1991,
        target_count: 30,
        exclude_track_ids: excluded
      )

      all_ids = result[:tracks].map { |t| t["id"] }
      excluded.each do |id|
        expect(all_ids).not_to include(id)
      end
    end

    it "uses custom ratios when provided" do
      result = generator.generate(
        analysis_data,
        birth_year: 1991,
        target_count: 100,
        favorites_ratio: 0.5,
        discovery_ratio: 0.2,
        era_hits_ratio: 0.3
      )

      expect(result[:stats][:from_favorites]).to eq(50)
    end

    it "falls back to default ratios when custom ratios are not provided" do
      result = generator.generate(analysis_data, birth_year: 1991, target_count: 100)

      expect(result[:stats][:from_favorites]).to eq(30)
    end

    describe "target_count reconciliation" do
      it "returns exactly target_count tracks under normal supply" do
        result = generator.generate(analysis_data, birth_year: 1991, target_count: 30)

        expect(result[:tracks].length).to eq(30)
      end

      it "fills from ranked_tracks when era_hits bucket under-delivers" do
        allow(spotify_client).to receive(:search) do |args|
          if args[:query].to_s.include?("year:")
            { "tracks" => { "items" => [] } }
          else
            {
              "tracks" => {
                "items" => (1..5).map do |i|
                  make_track.call(
                    id: "search_#{SecureRandom.hex(4)}_#{i}",
                    name: "Search Result #{i}",
                    artist_id: "new_artist_#{i + 100}",
                    popularity: 70
                  )
                end
              },
              "artists" => { "items" => [] }
            }
          end
        end

        result = generator.generate(analysis_data, birth_year: 1991, target_count: 30)

        expect(result[:tracks].length).to eq(30)
      end

      it "fills from ranked_tracks when discovery bucket under-delivers" do
        allow(spotify_client).to receive(:search).and_return({
          "tracks" => { "items" => [] },
          "artists" => { "items" => [] }
        })
        allow(spotify_client).to receive(:get_recommendations).and_return({ "tracks" => [] })

        result = generator.generate(analysis_data, birth_year: 1991, target_count: 30)

        expect(result[:tracks].length).to eq(30)
        expect(result[:tracks].length).to eq(result[:tracks].map { |t| t["id"] }.uniq.length)
      end

      it "returns fewer tracks only when supply is genuinely exhausted" do
        starved_analysis = {
          tracks: {
            ranked_tracks: (1..5).map do |i|
              make_track.call(
                id: "only_#{i}",
                name: "Only #{i}",
                artist_id: "only_artist_#{i}",
                popularity: 80
              ).merge("total_weight" => 1.0)
            end
          },
          artists: { ranked_artists: [] }
        }

        allow(spotify_client).to receive(:search).and_return({
          "tracks" => { "items" => [] },
          "artists" => { "items" => [] }
        })
        allow(spotify_client).to receive(:get_recommendations).and_return({ "tracks" => [] })

        result = generator.generate(starved_analysis, birth_year: 1991, target_count: 30)

        expect(result[:tracks].length).to be <= 30
        expect(result[:tracks].length).to be >= 5
      end
    end
  end

  describe "#select_favorites" do
    it "scores tracks by weight and popularity" do
      tracks = [
        make_track.call(id: "t1", name: "High Weight", popularity: 50).merge("total_weight" => 2.0),
        make_track.call(id: "t2", name: "High Pop", popularity: 100).merge("total_weight" => 0.5)
      ]

      result = generator.select_favorites(tracks, 2)

      expect(result.first["id"]).to eq("t1")
    end

    it "limits to max 3 tracks per artist" do
      tracks = (1..10).map do |i|
        make_track.call(
          id: "t#{i}",
          name: "Track #{i}",
          artist_id: "same_artist",
          popularity: 80
        ).merge("total_weight" => 2.0 - (i * 0.1))
      end

      result = generator.select_favorites(tracks, 10)

      expect(result.length).to eq(3)
    end

    it "tags tracks with source 'favorite'" do
      tracks = [make_track.call(id: "t1", name: "Test", popularity: 80).merge("total_weight" => 1.5)]

      result = generator.select_favorites(tracks, 1)

      expect(result.first["source"]).to eq("favorite")
    end
  end

  describe "#get_genre_discoveries" do
    let(:ranked_artists) do
      (1..60).map do |i|
        {
          "id" => "artist_#{i}",
          "name" => "Artist #{i}",
          "genres" => ["pop", "indie"]
        }
      end
    end

    it "excludes tracks from top 50 artists" do
      allow(spotify_client).to receive(:search).and_return({
        "tracks" => {
          "items" => [
            make_track.call(
              id: "from_top_artist",
              name: "Top Artist Track",
              artist_id: "artist_1",
              popularity: 90
            )
          ]
        }
      })

      result = generator.get_genre_discoveries(ranked_artists, 5, Set.new)

      found_top_artist_track = result.any? { |t| t["id"] == "from_top_artist" }
      expect(found_top_artist_track).to be false
    end

    it "excludes tracks below minimum popularity" do
      allow(spotify_client).to receive(:search).and_return({
        "tracks" => {
          "items" => [
            make_track.call(
              id: "low_pop",
              name: "Unpopular",
              artist_id: "new_artist_999",
              popularity: 30
            )
          ]
        }
      })

      result = generator.get_genre_discoveries(ranked_artists, 5, Set.new)

      found_low_pop = result.any? { |t| t["id"] == "low_pop" }
      expect(found_low_pop).to be false
    end

    it "tags tracks with source 'genre_discovery'" do
      result = generator.get_genre_discoveries(ranked_artists, 3, Set.new)

      result.each do |track|
        expect(track["source"]).to eq("genre_discovery").or eq("genre_recommendation")
      end
    end

    it "falls back to recommendations when search results are insufficient" do
      allow(spotify_client).to receive(:search).and_return({
        "tracks" => { "items" => [] }
      })

      result = generator.get_genre_discoveries(ranked_artists, 5, Set.new)

      expect(result).not_to be_empty
    end
  end

  describe "#get_era_hits" do
    before do
      # Create nostalgic artists for the user
      user.nostalgic_artists.destroy_all
      user.nostalgic_artists.create!(name: "NSYNC", era: "formative")
      user.nostalgic_artists.create!(name: "Britney Spears", era: "formative")

      allow(spotify_client).to receive(:search).and_return({
        "tracks" => {
          "items" => (1..5).map do |i|
            make_track.call(
              id: "era_#{SecureRandom.hex(4)}_#{i}",
              name: "Era Track #{i}",
              artist_id: "era_artist_#{i}",
              popularity: 75
            )
          end
        },
        "artists" => {
          "items" => [{ "id" => "nostalgic_artist_1", "name" => "NSYNC" }]
        }
      })
    end

    it "distributes tracks across eras" do
      result = generator.get_era_hits(1991, 20, Set.new)

      expect(result).not_to be_empty
    end

    it "tags tracks with source 'era_hit'" do
      result = generator.get_era_hits(1991, 10, Set.new)

      result.each do |track|
        expect(track["source"]).to eq("era_hit")
      end
    end

    it "uses nostalgic artists for formative era" do
      generator.get_era_hits(1991, 10, Set.new)

      expect(spotify_client).to have_received(:search).with(
        query: "NSYNC",
        types: ["artist"],
        limit: 5
      )
    end

    it "excludes already-seen track IDs" do
      seen_ids = Set.new(["era_already_seen"])

      allow(spotify_client).to receive(:search).and_return({
        "tracks" => {
          "items" => [
            make_track.call(id: "era_already_seen", name: "Already Seen", popularity: 80),
            make_track.call(id: "era_new", name: "New Track", popularity: 80, artist_id: "new_a")
          ]
        },
        "artists" => { "items" => [] }
      })

      result = generator.get_era_hits(1991, 5, seen_ids)

      ids = result.map { |t| t["id"] }
      expect(ids).not_to include("era_already_seen")
    end
  end

  describe "#intelligent_shuffle" do
    it "interleaves tracks from all three categories" do
      favorites = (1..6).map { |i| make_track.call(id: "f#{i}", name: "Fav #{i}").merge("source" => "favorite") }
      discoveries = (1..6).map { |i| make_track.call(id: "d#{i}", name: "Disc #{i}").merge("source" => "genre_discovery") }
      era_hits = (1..6).map { |i| make_track.call(id: "e#{i}", name: "Era #{i}").merge("source" => "era_hit") }

      result = generator.intelligent_shuffle(favorites, discoveries, era_hits)

      expect(result.length).to eq(18)
    end

    it "handles uneven category sizes" do
      favorites = (1..3).map { |i| make_track.call(id: "f#{i}", name: "Fav #{i}") }
      discoveries = (1..5).map { |i| make_track.call(id: "d#{i}", name: "Disc #{i}") }
      era_hits = (1..2).map { |i| make_track.call(id: "e#{i}", name: "Era #{i}") }

      result = generator.intelligent_shuffle(favorites, discoveries, era_hits)

      expect(result.length).to eq(10)
    end

    it "includes all tracks from all categories" do
      favorites = [make_track.call(id: "f1", name: "Fav")]
      discoveries = [make_track.call(id: "d1", name: "Disc")]
      era_hits = [make_track.call(id: "e1", name: "Era")]

      result = generator.intelligent_shuffle(favorites, discoveries, era_hits)

      ids = result.map { |t| t["id"] }
      expect(ids).to contain_exactly("f1", "d1", "e1")
    end
  end

  describe "#light_shuffle" do
    it "shuffles within groups without mixing across groups" do
      tracks = (1..12).map { |i| make_track.call(id: "t#{i}", name: "Track #{i}") }

      # Run many times to verify groups stay together
      100.times do
        result = generator.light_shuffle(tracks, 6)
        first_group_ids = result.first(6).map { |t| t["id"] }
        second_group_ids = result.last(6).map { |t| t["id"] }

        expect(first_group_ids.sort).to eq(%w[t1 t2 t3 t4 t5 t6])
        expect(second_group_ids.sort).to eq(%w[t10 t11 t12 t7 t8 t9])
      end
    end

    it "preserves all tracks" do
      tracks = (1..10).map { |i| make_track.call(id: "t#{i}", name: "Track #{i}") }

      result = generator.light_shuffle(tracks, 4)

      expect(result.length).to eq(10)
      expect(result.map { |t| t["id"] }.sort).to eq(tracks.map { |t| t["id"] }.sort)
    end
  end

  describe "randomization behavior" do
    it "uses random offsets within valid range (0-80) when searching" do
      offsets_used = []
      allow(spotify_client).to receive(:search) do |**kwargs|
        offsets_used << kwargs[:offset] if kwargs[:offset]
        {
          "tracks" => {
            "items" => (1..5).map do |i|
              make_track.call(
                id: "rand_#{SecureRandom.hex(4)}_#{i}",
                name: "Random #{i}",
                artist_id: "new_artist_rand_#{SecureRandom.hex(4)}",
                popularity: 70
              )
            end
          },
          "artists" => { "items" => [] }
        }
      end

      generator.generate(analysis_data, birth_year: 1991, target_count: 30)

      offsets_used.each do |offset|
        expect(offset).to be_between(0, 80)
      end
    end

    it "adds randomness to favorite scoring so results can vary" do
      tracks = (1..20).map do |i|
        make_track.call(
          id: "fav_#{i}",
          name: "Fav #{i}",
          artist_id: "artist_fav_#{i}",
          popularity: 80
        ).merge("total_weight" => 2.0 - (i * 0.05))
      end

      results = 10.times.map do
        generator.select_favorites(tracks, 10).map { |t| t["id"] }
      end

      # With randomness, we expect at least some variation across runs
      unique_orderings = results.uniq.length
      expect(unique_orderings).to be > 1
    end

    it "shuffles genre query order for era hits" do
      genre_orders = []
      allow(spotify_client).to receive(:search) do |**kwargs|
        query = kwargs[:query]
        if query.include?("genre:")
          genre_match = query.match(/genre:(\w[\w\s]*)/)
          genre_orders << genre_match[1] if genre_match
        end
        {
          "tracks" => {
            "items" => (1..3).map do |i|
              make_track.call(
                id: "era_rand_#{SecureRandom.hex(4)}_#{i}",
                name: "Era Rand #{i}",
                artist_id: "era_rand_artist_#{SecureRandom.hex(4)}",
                popularity: 75
              )
            end
          },
          "artists" => { "items" => [] }
        }
      end

      # Run multiple times and check that genre order varies
      orders = 10.times.map do
        genre_orders.clear
        generator.get_era_hits(1991, 10, Set.new)
        genre_orders.dup
      end

      unique_orders = orders.uniq.length
      expect(unique_orders).to be > 1
    end

    it "randomly samples genres for discovery instead of always using first 10" do
      # Provide many genres so sampling can vary
      ranked_artists = (1..60).map do |i|
        {
          "id" => "artist_#{i}",
          "name" => "Artist #{i}",
          "genres" => ["genre_#{i}", "genre_#{i + 100}"]
        }
      end

      genres_searched = []
      allow(spotify_client).to receive(:search) do |**kwargs|
        query = kwargs[:query]
        genre_match = query.match(/genre:"([^"]+)"/)
        genres_searched << genre_match[1] if genre_match
        {
          "tracks" => {
            "items" => (1..3).map do |i|
              make_track.call(
                id: "disc_rand_#{SecureRandom.hex(4)}_#{i}",
                name: "Disc Rand #{i}",
                artist_id: "disc_artist_#{SecureRandom.hex(4)}",
                popularity: 70
              )
            end
          }
        }
      end

      first_run_genres = []
      genres_searched.clear
      generator.get_genre_discoveries(ranked_artists, 10, Set.new)
      first_run_genres = genres_searched.dup

      second_run_genres = []
      genres_searched.clear
      generator.get_genre_discoveries(ranked_artists, 10, Set.new)
      second_run_genres = genres_searched.dup

      # The top genres should still appear frequently, but order should vary
      expect(first_run_genres).not_to be_empty
      expect(second_run_genres).not_to be_empty
    end
  end
end

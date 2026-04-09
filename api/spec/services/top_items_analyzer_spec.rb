require "rails_helper"

RSpec.describe TopItemsAnalyzer do
  let(:spotify_client) { instance_double(SpotifyApiClient) }
  let(:analyzer) { described_class.new(spotify_client) }

  let(:artist_fixture) do
    lambda do |id:, name:, genres: [], popularity: 80|
      {
        "id" => id,
        "name" => name,
        "genres" => genres,
        "popularity" => popularity
      }
    end
  end

  let(:track_fixture) do
    lambda do |id:, name:, artists:, popularity: 70|
      {
        "id" => id,
        "name" => name,
        "artists" => artists.map { |a| { "id" => a[:id], "name" => a[:name] } },
        "popularity" => popularity,
        "duration_ms" => 210_000
      }
    end
  end

  describe "#calculate_weight" do
    it "returns 1.0 for position 0" do
      expect(analyzer.calculate_weight(0, 50)).to eq(1.0)
    end

    it "returns approximately 0.1 for the last position" do
      weight = analyzer.calculate_weight(49, 50)
      expect(weight).to be_within(0.02).of(0.118)
    end

    it "returns higher weights for earlier positions" do
      weight_first = analyzer.calculate_weight(0, 50)
      weight_mid = analyzer.calculate_weight(25, 50)
      weight_last = analyzer.calculate_weight(49, 50)

      expect(weight_first).to be > weight_mid
      expect(weight_mid).to be > weight_last
    end

    it "applies formula: 1 - (position / total) * 0.9" do
      weight = analyzer.calculate_weight(10, 50)
      expected = 1 - (10.0 / 50) * 0.9

      expect(weight).to eq(expected)
    end
  end

  describe "#analyze_artists" do
    let(:shared_artist) { artist_fixture.call(id: "a1", name: "Artist One", genres: ["rock", "indie"]) }

    let(:artists_by_time_range) do
      {
        "short_term" => [
          shared_artist,
          artist_fixture.call(id: "a2", name: "Artist Two", genres: ["pop"])
        ],
        "medium_term" => [
          shared_artist,
          artist_fixture.call(id: "a3", name: "Artist Three", genres: ["rock"])
        ],
        "long_term" => [
          shared_artist,
          artist_fixture.call(id: "a4", name: "Artist Four", genres: ["jazz"])
        ]
      }
    end

    it "ranks artists by total weight across time ranges" do
      result = analyzer.analyze_artists(artists_by_time_range)

      expect(result[:ranked_artists].first["id"]).to eq("a1")
      expect(result[:ranked_artists].first["total_weight"]).to be > 2.0
    end

    it "finds consistent favorites that appear in all time ranges" do
      result = analyzer.analyze_artists(artists_by_time_range)

      expect(result[:consistent_favorites].length).to eq(1)
      expect(result[:consistent_favorites].first["id"]).to eq("a1")
    end

    it "counts genres weighted by position" do
      result = analyzer.analyze_artists(artists_by_time_range)
      top_genres = result[:top_genres]

      rock_genre = top_genres.find { |g| g[:genre] == "rock" }
      expect(rock_genre).not_to be_nil
      expect(rock_genre[:weight]).to be > 0
    end

    it "returns total unique artist count" do
      result = analyzer.analyze_artists(artists_by_time_range)

      expect(result[:total_unique_artists]).to eq(4)
    end

    it "limits top genres to 20" do
      many_genre_artists = (1..25).map do |i|
        artist_fixture.call(id: "a#{i}", name: "Artist #{i}", genres: ["genre_#{i}"])
      end

      result = analyzer.analyze_artists({ "short_term" => many_genre_artists })

      expect(result[:top_genres].length).to be <= 20
    end
  end

  describe "#analyze_tracks" do
    let(:shared_track) do
      track_fixture.call(
        id: "t1", name: "Track One",
        artists: [{ id: "a1", name: "Artist One" }],
        popularity: 85
      )
    end

    let(:tracks_by_time_range) do
      {
        "short_term" => [
          shared_track,
          track_fixture.call(id: "t2", name: "Track Two", artists: [{ id: "a2", name: "Artist Two" }])
        ],
        "medium_term" => [
          shared_track,
          track_fixture.call(id: "t3", name: "Track Three", artists: [{ id: "a3", name: "Artist Three" }])
        ],
        "long_term" => [
          shared_track,
          track_fixture.call(id: "t4", name: "Track Four", artists: [{ id: "a1", name: "Artist One" }])
        ]
      }
    end

    it "ranks tracks by total weight across time ranges" do
      result = analyzer.analyze_tracks(tracks_by_time_range)

      expect(result[:ranked_tracks].first["id"]).to eq("t1")
    end

    it "finds consistent favorites that appear in all time ranges" do
      result = analyzer.analyze_tracks(tracks_by_time_range)

      expect(result[:consistent_favorites].length).to eq(1)
      expect(result[:consistent_favorites].first["id"]).to eq("t1")
    end

    it "returns total unique track count" do
      result = analyzer.analyze_tracks(tracks_by_time_range)

      expect(result[:total_unique_tracks]).to eq(4)
    end

    it "tracks artist track counts" do
      result = analyzer.analyze_tracks(tracks_by_time_range)

      expect(result[:artist_track_counts]["a1"]).to be >= 3
    end
  end

  describe "#analyze" do
    let(:time_ranges) { %w[short_term medium_term long_term] }

    before do
      time_ranges.each do |range|
        allow(spotify_client).to receive(:top_artists)
          .with(time_range: range, limit: 50)
          .and_return({ "items" => [artist_fixture.call(id: "a1", name: "Test", genres: ["rock"])] })

        allow(spotify_client).to receive(:top_tracks)
          .with(time_range: range, limit: 50)
          .and_return({ "items" => [track_fixture.call(id: "t1", name: "Test Track", artists: [{ id: "a1", name: "Test" }])] })
      end
    end

    it "fetches top artists and tracks for all time ranges" do
      result = analyzer.analyze

      time_ranges.each do |range|
        expect(spotify_client).to have_received(:top_artists).with(time_range: range, limit: 50)
        expect(spotify_client).to have_received(:top_tracks).with(time_range: range, limit: 50)
      end
    end

    it "returns raw data and analysis" do
      result = analyzer.analyze

      expect(result).to have_key(:raw)
      expect(result).to have_key(:analysis)
      expect(result[:raw]).to have_key(:top_artists)
      expect(result[:raw]).to have_key(:top_tracks)
      expect(result[:analysis]).to have_key(:artists)
      expect(result[:analysis]).to have_key(:tracks)
    end

    it "includes ranked artists in analysis" do
      result = analyzer.analyze

      expect(result[:analysis][:artists][:ranked_artists]).not_to be_empty
    end

    it "includes ranked tracks in analysis" do
      result = analyzer.analyze

      expect(result[:analysis][:tracks][:ranked_tracks]).not_to be_empty
    end
  end
end

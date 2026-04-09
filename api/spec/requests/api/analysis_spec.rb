require "rails_helper"

RSpec.describe "Api::Analysis", type: :request do
  let(:user) { create(:user) }

  before { sign_in(user) }

  let(:raw_artist) do
    {
      "id" => "artist1",
      "name" => "Test Artist",
      "genres" => ["indie rock", "alternative"],
      "images" => [{ "url" => "https://img.com/1.jpg" }],
      "popularity" => 85,
      "total_weight" => 2.5,
      "time_ranges" => %w[short_term medium_term long_term]
    }
  end

  let(:raw_track) do
    {
      "id" => "track1",
      "name" => "Test Track",
      "artists" => [{ "id" => "artist1", "name" => "Test Artist" }],
      "album" => { "name" => "Test Album", "images" => [{ "url" => "https://img.com/album.jpg" }] },
      "duration_ms" => 240_000,
      "uri" => "spotify:track:track1",
      "popularity" => 80,
      "total_weight" => 1.8,
      "time_ranges" => %w[short_term medium_term]
    }
  end

  let(:analysis_result) do
    {
      raw: {},
      analysis: {
        artists: {
          top_genres: [{ genre: "indie rock", weight: 3.5 }],
          ranked_artists: [raw_artist] * 50,
          consistent_favorites: [raw_artist] * 20,
          total_unique_artists: 100
        },
        tracks: {
          ranked_tracks: [raw_track] * 50,
          consistent_favorites: [raw_track] * 20,
          total_unique_tracks: 120,
          artist_track_counts: {}
        }
      }
    }
  end

  describe "GET /api/analysis" do
    before do
      allow_any_instance_of(TopItemsAnalyzer).to receive(:analyze).and_return(analysis_result)
    end

    it "returns analysis data" do
      get "/api/analysis"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body

      expect(body["artists"]).to be_present
      expect(body["tracks"]).to be_present
    end

    it "returns simplified artist data" do
      get "/api/analysis"

      body = response.parsed_body
      artist = body["artists"]["rankedArtists"].first

      expect(artist).to have_key("id")
      expect(artist).to have_key("name")
      expect(artist).to have_key("genres")
      expect(artist).to have_key("images")
      expect(artist).to have_key("popularity")
      expect(artist).to have_key("totalWeight")
      expect(artist).to have_key("timeRanges")
    end

    it "returns simplified track data" do
      get "/api/analysis"

      body = response.parsed_body
      track = body["tracks"]["rankedTracks"].first

      expect(track).to have_key("id")
      expect(track).to have_key("name")
      expect(track).to have_key("artists")
      expect(track).to have_key("album")
      expect(track).to have_key("duration_ms")
      expect(track).to have_key("uri")
      expect(track).to have_key("popularity")
    end

    it "limits ranked artists to 50" do
      get "/api/analysis"

      body = response.parsed_body
      expect(body["artists"]["rankedArtists"].length).to be <= 50
    end

    it "limits consistent favorite artists to 20" do
      get "/api/analysis"

      body = response.parsed_body
      expect(body["artists"]["consistentFavorites"].length).to be <= 20
    end

    it "includes total unique counts" do
      get "/api/analysis"

      body = response.parsed_body
      expect(body["artists"]["totalUniqueArtists"]).to eq(100)
      expect(body["tracks"]["totalUniqueTracks"]).to eq(120)
    end
  end
end

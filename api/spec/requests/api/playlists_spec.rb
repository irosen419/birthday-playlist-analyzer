require "rails_helper"

RSpec.describe "Api::Playlists", type: :request do
  let(:user) { create(:user, birth_year: 1991) }

  before { sign_in(user) }

  describe "GET /api/playlists" do
    it "returns the current user's playlists with track counts" do
      playlist = create(:playlist, user: user, name: "My Birthday Mix")
      track = create(:track)
      create(:playlist_track, playlist: playlist, track: track, position: 1)

      get "/api/playlists"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body.length).to eq(1)
      expect(body.first["name"]).to eq("My Birthday Mix")
      expect(body.first["track_count"]).to eq(1)
    end

    it "does not return other users' playlists" do
      other_user = create(:user)
      create(:playlist, user: other_user, name: "Not Mine")

      get "/api/playlists"

      names = response.parsed_body.map { |p| p["name"] }
      expect(names).not_to include("Not Mine")
    end

    it "excludes playlists with zero tracks" do
      empty = create(:playlist, user: user, name: "Empty Playlist")
      populated = create(:playlist, user: user, name: "Has Tracks")
      create(:playlist_track, playlist: populated, track: create(:track), position: 1)

      get "/api/playlists"

      names = response.parsed_body.map { |p| p["name"] }
      expect(names).to include("Has Tracks")
      expect(names).not_to include("Empty Playlist")
      expect(response.parsed_body.map { |p| p["id"] }).not_to include(empty.id)
    end

    it "preserves ordering when filtering empty playlists" do
      older = create(:playlist, user: user, name: "Older", created_at: 2.days.ago)
      create(:playlist_track, playlist: older, track: create(:track), position: 1)
      create(:playlist, user: user, name: "Empty Middle", created_at: 1.day.ago)
      newer = create(:playlist, user: user, name: "Newer", created_at: 1.hour.ago)
      create(:playlist_track, playlist: newer, track: create(:track), position: 1)

      get "/api/playlists"

      names = response.parsed_body.map { |p| p["name"] }
      expect(names).to eq(["Older", "Newer"])
    end
  end

  describe "GET /api/playlists/:id" do
    it "returns playlist with ordered tracks" do
      playlist = create(:playlist, user: user)
      track1 = create(:track, name: "Track One")
      track2 = create(:track, name: "Track Two")
      create(:playlist_track, playlist: playlist, track: track2, position: 2, locked: true, source: :manual)
      create(:playlist_track, playlist: playlist, track: track1, position: 1, locked: false, source: :favorite)

      get "/api/playlists/#{playlist.id}"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["name"]).to eq(playlist.name)
      expect(body["tracks"].length).to eq(2)
      expect(body["tracks"].first["name"]).to eq("Track One")
      expect(body["tracks"].first["position"]).to eq(1)
      expect(body["tracks"].first["locked"]).to be false
      expect(body["tracks"].last["locked"]).to be true
      expect(body["tracks"].last["source"]).to eq("manual")
    end

    it "returns 404 for another user's playlist" do
      other_user = create(:user)
      playlist = create(:playlist, user: other_user)

      get "/api/playlists/#{playlist.id}"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/playlists" do
    it "creates a playlist" do
      expect {
        post "/api/playlists", params: { name: "Birthday 2025", birth_year: 1991 }
      }.to change(user.playlists, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body["name"]).to eq("Birthday 2025")
      expect(response.parsed_body["birth_year"]).to eq(1991)
    end

    it "returns errors for invalid params" do
      post "/api/playlists", params: { name: "" }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "accepts generation config params" do
      post "/api/playlists", params: {
        name: "Custom Config",
        birth_year: 1991,
        favorites_ratio: 0.4,
        discovery_ratio: 0.3,
        era_hits_ratio: 0.3,
        target_song_count: 100
      }

      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["favorites_ratio"]).to eq(0.4)
      expect(body["target_song_count"]).to eq(100)
    end
  end

  describe "PATCH /api/playlists/:id" do
    let(:playlist) { create(:playlist, user: user) }

    it "updates playlist name" do
      patch "/api/playlists/#{playlist.id}", params: { name: "Updated Name" }

      expect(response).to have_http_status(:ok)
      expect(playlist.reload.name).to eq("Updated Name")
    end

    it "replaces all tracks via auto-save" do
      existing_track = create(:track)
      create(:playlist_track, playlist: playlist, track: existing_track, position: 1)

      track_params = [
        {
          spotify_id: "new_track_1",
          position: 1,
          locked: false,
          source: "favorite",
          name: "New Song",
          artists: [{ id: "a1", name: "Artist A" }],
          album: { name: "Album X", images: [{ url: "https://img.com/x.jpg" }] },
          duration_ms: 200_000,
          popularity: 75,
          preview_url: "https://preview.com/1",
          uri: "spotify:track:new_track_1"
        },
        {
          spotify_id: "new_track_2",
          position: 2,
          locked: true,
          source: "manual",
          name: "Another Song",
          artists: [{ id: "a2", name: "Artist B" }],
          album: { name: "Album Y", images: [{ url: "https://img.com/y.jpg" }] },
          duration_ms: 180_000,
          popularity: 60,
          preview_url: nil,
          uri: "spotify:track:new_track_2"
        }
      ]

      patch "/api/playlists/#{playlist.id}",
        params: { tracks: track_params },
        as: :json

      expect(response).to have_http_status(:ok)

      playlist.reload
      expect(playlist.playlist_tracks.count).to eq(2)
      expect(playlist.playlist_tracks.order(:position).first.track.name).to eq("New Song")
      expect(playlist.playlist_tracks.order(:position).last.locked).to be true
    end

    it "upserts tracks into the tracks table" do
      track_params = [
        {
          spotify_id: "upsert_test",
          position: 1,
          locked: false,
          source: "favorite",
          name: "Upsert Song",
          artists: [{ id: "a1", name: "Artist" }],
          album: { name: "Album", images: [{ url: "https://img.com/1.jpg" }] },
          duration_ms: 200_000,
          popularity: 70,
          preview_url: nil,
          uri: "spotify:track:upsert_test"
        }
      ]

      expect {
        patch "/api/playlists/#{playlist.id}",
          params: { tracks: track_params },
          as: :json
      }.to change(Track, :count).by(1)

      expect(Track.find_by(spotify_id: "upsert_test").name).to eq("Upsert Song")
    end

    it "updates generation config params" do
      patch "/api/playlists/#{playlist.id}", params: {
        favorites_ratio: 0.5,
        discovery_ratio: 0.2,
        era_hits_ratio: 0.3,
        target_song_count: 80
      }

      expect(response).to have_http_status(:ok)
      playlist.reload
      expect(playlist.favorites_ratio).to eq(0.5)
      expect(playlist.discovery_ratio).to eq(0.2)
      expect(playlist.era_hits_ratio).to eq(0.3)
      expect(playlist.target_song_count).to eq(80)
    end

    it "returns 404 for another user's playlist" do
      other_user = create(:user)
      other_playlist = create(:playlist, user: other_user)

      patch "/api/playlists/#{other_playlist.id}", params: { name: "Hacked" }

      expect(response).to have_http_status(:not_found)
    end

    context "with an oversized tracks payload" do
      let(:playlist) { create(:playlist, user: user) }

      def oversized_tracks(count)
        Array.new(count) do |i|
          {
            spotify_id: "track_#{i}",
            position: i + 1,
            locked: false,
            source: "favorite",
            name: "Track #{i}",
            artists: [{ id: "a#{i}", name: "Artist #{i}" }],
            album: { name: "Album", images: [] },
            duration_ms: 200_000,
            popularity: 50,
            preview_url: nil,
            uri: "spotify:track:track_#{i}"
          }
        end
      end

      it "rejects payloads with more than 500 tracks" do
        patch "/api/playlists/#{playlist.id}",
          params: { tracks: oversized_tracks(501) },
          as: :json

        expect(response).to have_http_status(:payload_too_large)
        expect(response.parsed_body).to eq("error" => "Too many tracks (max 500)")
      end

      it "does not persist any tracks when the payload is oversized" do
        expect {
          patch "/api/playlists/#{playlist.id}",
            params: { tracks: oversized_tracks(501) },
            as: :json
        }.not_to change { playlist.reload.playlist_tracks.count }
      end

      it "accepts payloads with exactly 500 tracks" do
        patch "/api/playlists/#{playlist.id}",
          params: { tracks: oversized_tracks(500) },
          as: :json

        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "DELETE /api/playlists/:id" do
    it "destroys the playlist" do
      playlist = create(:playlist, user: user)

      expect {
        delete "/api/playlists/#{playlist.id}"
      }.to change(user.playlists, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end

  describe "POST /api/playlists/:id/generate" do
    let(:playlist) { create(:playlist, user: user, birth_year: 1991) }

    let(:generated_tracks) do
      [
        {
          "id" => "gen1",
          "name" => "Generated Track",
          "artists" => [{ "id" => "a1", "name" => "Gen Artist" }],
          "album" => { "name" => "Gen Album", "images" => [] },
          "duration_ms" => 210_000,
          "uri" => "spotify:track:gen1",
          "popularity" => 80,
          "source" => "favorite"
        }
      ]
    end

    let(:generate_result) do
      {
        tracks: generated_tracks,
        favorites: generated_tracks,
        genre_discoveries: [],
        era_hits: [],
        stats: {
          total_tracks: 1,
          from_favorites: 1,
          from_genre_discovery: 0,
          from_era_hits: 0,
          birth_year: 1991
        }
      }
    end

    let(:analysis_data) do
      {
        raw: {},
        analysis: {
          artists: { ranked_artists: [], top_genres: [], consistent_favorites: [], total_unique_artists: 0 },
          tracks: { ranked_tracks: [], consistent_favorites: [], total_unique_tracks: 0, artist_track_counts: {} }
        }
      }
    end

    before do
      allow_any_instance_of(TopItemsAnalyzer).to receive(:analyze).and_return(analysis_data)
      allow_any_instance_of(PlaylistGeneratorService).to receive(:generate).and_return(generate_result)
    end

    it "returns generated tracks without saving to database" do
      post "/api/playlists/#{playlist.id}/generate",
        params: { birth_year: 1991, locked_track_ids: [] },
        as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["tracks"]).to be_present
      expect(body["stats"]).to be_present
      expect(playlist.reload.playlist_tracks.count).to eq(0)
    end

    it "passes locked track count to determine target_count" do
      expect_any_instance_of(PlaylistGeneratorService).to receive(:generate).with(
        anything,
        hash_including(target_count: 123, exclude_track_ids: %w[locked1 locked2])
      ).and_return(generate_result)

      post "/api/playlists/#{playlist.id}/generate",
        params: { birth_year: 1991, locked_track_ids: %w[locked1 locked2] },
        as: :json
    end

    it "uses the playlist's stored config for generation ratios" do
      playlist.update!(favorites_ratio: 0.5, discovery_ratio: 0.2, era_hits_ratio: 0.3, target_song_count: 80)

      expect_any_instance_of(PlaylistGeneratorService).to receive(:generate).with(
        anything,
        hash_including(
          favorites_ratio: 0.5,
          discovery_ratio: 0.2,
          era_hits_ratio: 0.3,
          target_count: 80
        )
      ).and_return(generate_result)

      post "/api/playlists/#{playlist.id}/generate",
        params: { birth_year: 1991 },
        as: :json
    end
  end

  describe "POST /api/playlists/:id/publish" do
    let(:playlist) { create(:playlist, user: user) }

    context "when playlist has no spotify_playlist_id (first publish)" do
      before do
        track = create(:track, uri: "spotify:track:abc")
        create(:playlist_track, playlist: playlist, track: track, position: 1)

        allow_any_instance_of(SpotifyApiClient).to receive(:create_playlist).and_return({
          "id" => "sp_playlist_123",
          "external_urls" => { "spotify" => "https://open.spotify.com/playlist/sp_playlist_123" }
        })
        allow_any_instance_of(SpotifyApiClient).to receive(:add_tracks_to_playlist)
      end

      it "creates a new Spotify playlist" do
        post "/api/playlists/#{playlist.id}/publish"

        expect(response).to have_http_status(:ok)
        body = response.parsed_body
        expect(body["id"]).to eq(playlist.id)
        expect(body["url"]).to include("spotify.com")

        playlist.reload
        expect(playlist.spotify_playlist_id).to eq("sp_playlist_123")
        expect(playlist.published_at).to be_present
      end
    end

    context "when playlist already has spotify_playlist_id (republish)" do
      before do
        playlist.update!(spotify_playlist_id: "existing_sp_id")
        track = create(:track, uri: "spotify:track:abc")
        create(:playlist_track, playlist: playlist, track: track, position: 1)

        allow_any_instance_of(SpotifyApiClient).to receive(:replace_playlist_tracks)
        allow_any_instance_of(SpotifyApiClient).to receive(:add_tracks_to_playlist)
      end

      it "replaces tracks on existing Spotify playlist" do
        expect_any_instance_of(SpotifyApiClient).to receive(:replace_playlist_tracks)

        post "/api/playlists/#{playlist.id}/publish"

        expect(response).to have_http_status(:ok)
        expect(playlist.reload.published_at).to be_present
      end
    end
  end
end

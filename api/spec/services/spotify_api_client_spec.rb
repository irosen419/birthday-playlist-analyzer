require "rails_helper"

RSpec.describe SpotifyApiClient do
  let(:user) { create(:user, token_expires_at: 1.hour.from_now) }
  let(:client) { described_class.new(user) }
  let(:base_url) { "https://api.spotify.com/v1" }

  let(:auth_header) { { "Authorization" => "Bearer #{user.access_token}" } }

  describe "#current_user" do
    it "fetches the current user profile" do
      stub_request(:get, "#{base_url}/me")
        .with(headers: auth_header)
        .to_return(status: 200, body: { id: "user_123", display_name: "Test" }.to_json)

      result = client.current_user

      expect(result["id"]).to eq("user_123")
    end
  end

  describe "#top_artists" do
    it "fetches top artists with time range and limit" do
      stub_request(:get, "#{base_url}/me/top/artists")
        .with(
          query: { time_range: "long_term", limit: "25" },
          headers: auth_header
        )
        .to_return(status: 200, body: { items: [{ id: "artist_1" }] }.to_json)

      result = client.top_artists(time_range: "long_term", limit: 25)

      expect(result["items"].length).to eq(1)
    end

    it "uses default time_range and limit" do
      stub_request(:get, "#{base_url}/me/top/artists")
        .with(query: { time_range: "medium_term", limit: "50" })
        .to_return(status: 200, body: { items: [] }.to_json)

      client.top_artists
    end
  end

  describe "#top_tracks" do
    it "fetches top tracks with time range and limit" do
      stub_request(:get, "#{base_url}/me/top/tracks")
        .with(query: { time_range: "short_term", limit: "10" })
        .to_return(status: 200, body: { items: [{ id: "track_1" }] }.to_json)

      result = client.top_tracks(time_range: "short_term", limit: 10)

      expect(result["items"].first["id"]).to eq("track_1")
    end
  end

  describe "#search" do
    it "searches with query and type parameters" do
      stub_request(:get, "#{base_url}/search")
        .with(query: { q: "genre:\"indie rock\"", type: "track", limit: "20", offset: "0" })
        .to_return(status: 200, body: { tracks: { items: [] } }.to_json)

      result = client.search(query: "genre:\"indie rock\"")

      expect(result["tracks"]["items"]).to eq([])
    end

    it "supports multiple types" do
      stub_request(:get, "#{base_url}/search")
        .with(query: { q: "test", type: "track,artist", limit: "5", offset: "0" })
        .to_return(status: 200, body: { tracks: { items: [] }, artists: { items: [] } }.to_json)

      client.search(query: "test", types: ["track", "artist"], limit: 5)
    end

    it "passes offset parameter to Spotify" do
      stub_request(:get, "#{base_url}/search")
        .with(query: { q: "test", type: "track", limit: "20", offset: "42" })
        .to_return(status: 200, body: { tracks: { items: [] } }.to_json)

      client.search(query: "test", offset: 42)
    end

    it "defaults offset to 0" do
      stub_request(:get, "#{base_url}/search")
        .with(query: hash_including("offset" => "0"))
        .to_return(status: 200, body: { tracks: { items: [] } }.to_json)

      client.search(query: "anything")
    end
  end

  describe "#get_recommendations" do
    it "builds query with seed genres" do
      stub_request(:get, "#{base_url}/recommendations")
        .with(query: hash_including("seed_genres" => "pop,rock", "limit" => "20"))
        .to_return(status: 200, body: { tracks: [] }.to_json)

      client.get_recommendations(seed_genres: ["pop", "rock"])
    end

    it "builds query with seed artists and audio parameters" do
      stub_request(:get, "#{base_url}/recommendations")
        .with(query: hash_including(
          "seed_artists" => "a1,a2",
          "min_popularity" => "60",
          "limit" => "30"
        ))
        .to_return(status: 200, body: { tracks: [] }.to_json)

      client.get_recommendations(
        seed_artists: ["a1", "a2"],
        min_popularity: 60,
        limit: 30
      )
    end

    it "limits seed values to 5" do
      genres = %w[g1 g2 g3 g4 g5 g6 g7]

      stub_request(:get, "#{base_url}/recommendations")
        .with(query: hash_including("seed_genres" => "g1,g2,g3,g4,g5"))
        .to_return(status: 200, body: { tracks: [] }.to_json)

      client.get_recommendations(seed_genres: genres)
    end
  end

  describe "#artist_top_tracks" do
    it "fetches an artist's top tracks" do
      stub_request(:get, "#{base_url}/artists/artist_123/top-tracks")
        .with(query: { market: "US" })
        .to_return(status: 200, body: { tracks: [{ id: "t1" }] }.to_json)

      result = client.artist_top_tracks(artist_id: "artist_123")

      expect(result["tracks"].first["id"]).to eq("t1")
    end
  end

  describe "#related_artists" do
    it "fetches related artists" do
      stub_request(:get, "#{base_url}/artists/artist_123/related-artists")
        .to_return(status: 200, body: { artists: [{ id: "related_1" }] }.to_json)

      result = client.related_artists(artist_id: "artist_123")

      expect(result["artists"].first["id"]).to eq("related_1")
    end
  end

  describe "#create_playlist" do
    it "creates a playlist for the current user" do
      stub_request(:get, "#{base_url}/me")
        .to_return(status: 200, body: { id: "user_123" }.to_json)

      stub_request(:post, "#{base_url}/users/user_123/playlists")
        .with(body: { name: "My Playlist", description: "A test", public: true }.to_json)
        .to_return(status: 201, body: { id: "playlist_123", name: "My Playlist" }.to_json)

      result = client.create_playlist(name: "My Playlist", description: "A test")

      expect(result["id"]).to eq("playlist_123")
    end
  end

  describe "#add_tracks_to_playlist" do
    it "adds tracks to a playlist" do
      uris = ["spotify:track:1", "spotify:track:2"]

      stub_request(:post, "#{base_url}/playlists/pl_123/tracks")
        .with(body: { uris: uris }.to_json)
        .to_return(status: 201, body: { snapshot_id: "snap_1" }.to_json)

      client.add_tracks_to_playlist(playlist_id: "pl_123", track_uris: uris)
    end

    it "chunks requests at 100 tracks" do
      uris = (1..150).map { |i| "spotify:track:#{i}" }

      stub1 = stub_request(:post, "#{base_url}/playlists/pl_123/tracks")
        .with(body: { uris: uris.first(100) }.to_json)
        .to_return(status: 201, body: { snapshot_id: "snap_1" }.to_json)

      stub2 = stub_request(:post, "#{base_url}/playlists/pl_123/tracks")
        .with(body: { uris: uris.last(50) }.to_json)
        .to_return(status: 201, body: { snapshot_id: "snap_2" }.to_json)

      client.add_tracks_to_playlist(playlist_id: "pl_123", track_uris: uris)

      expect(stub1).to have_been_requested.once
      expect(stub2).to have_been_requested.once
    end
  end

  describe "#get_audio_features" do
    it "fetches audio features for track IDs" do
      stub_request(:get, "#{base_url}/audio-features")
        .with(query: { ids: "t1,t2,t3" })
        .to_return(status: 200, body: { audio_features: [{ id: "t1" }] }.to_json)

      result = client.get_audio_features(track_ids: ["t1", "t2", "t3"])

      expect(result["audio_features"].first["id"]).to eq("t1")
    end
  end

  describe "auto token refresh on 401" do
    let(:token_url) { "https://accounts.spotify.com/api/token" }

    before do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("SPOTIFY_CLIENT_ID").and_return("cid")
      allow(ENV).to receive(:[]).with("SPOTIFY_CLIENT_SECRET").and_return("csecret")
      allow(ENV).to receive(:[]).with("SPOTIFY_REDIRECT_URI").and_return("http://localhost:3000/auth/spotify/callback")
    end

    it "refreshes the token and retries the request on 401" do
      stub_request(:get, "#{base_url}/me")
        .with(headers: { "Authorization" => "Bearer #{user.access_token}" })
        .to_return(status: 401, body: { error: { message: "Token expired" } }.to_json)

      stub_request(:post, token_url)
        .to_return(
          status: 200,
          body: { access_token: "new_token", refresh_token: user.refresh_token, expires_in: 3600 }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_request(:get, "#{base_url}/me")
        .with(headers: { "Authorization" => "Bearer new_token" })
        .to_return(status: 200, body: { id: "user_123" }.to_json)

      result = client.current_user

      expect(result["id"]).to eq("user_123")
    end

    it "raises an error if token refresh also fails with 401" do
      stub_request(:get, "#{base_url}/me")
        .to_return(status: 401, body: { error: { message: "Token expired" } }.to_json)

      stub_request(:post, token_url)
        .to_return(
          status: 200,
          body: { access_token: "new_token", refresh_token: user.refresh_token, expires_in: 3600 }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      # Second request with new token also returns 401
      stub_request(:get, "#{base_url}/me")
        .with(headers: { "Authorization" => "Bearer new_token" })
        .to_return(status: 401, body: { error: { message: "Still unauthorized" } }.to_json)

      expect { client.current_user }.to raise_error(SpotifyApiError, /Token refresh failed/)
    end
  end

  describe "rate limit handling on 429" do
    it "waits and retries when receiving 429 with Retry-After header" do
      stub_request(:get, "#{base_url}/me")
        .to_return(
          { status: 429, headers: { "Retry-After" => "1" }, body: "" },
          { status: 200, body: { id: "user_123" }.to_json }
        )

      allow(client).to receive(:sleep)

      result = client.current_user

      expect(client).to have_received(:sleep).with(1)
      expect(result["id"]).to eq("user_123")
    end
  end

  describe "error handling" do
    it "raises SpotifyApiError on non-success responses" do
      stub_request(:get, "#{base_url}/me")
        .to_return(
          status: 403,
          body: { error: { message: "Forbidden" } }.to_json
        )

      expect { client.current_user }.to raise_error(SpotifyApiError, /Forbidden/)
    end

    it "handles 204 No Content responses" do
      stub_request(:get, "#{base_url}/me")
        .to_return(status: 204, body: "")

      result = client.current_user

      expect(result).to be_nil
    end
  end

  describe "#unfollow_playlist" do
    it "sends DELETE to the playlist followers endpoint" do
      stub = stub_request(:delete, "#{base_url}/playlists/pl_abc/followers")
        .with(headers: auth_header)
        .to_return(status: 200, body: "")

      client.unfollow_playlist(playlist_id: "pl_abc")

      expect(stub).to have_been_requested.once
    end

    it "raises SpotifyApiError when Spotify returns a non-success status" do
      stub_request(:delete, "#{base_url}/playlists/pl_abc/followers")
        .to_return(status: 403, body: { error: { message: "Forbidden" } }.to_json)

      expect { client.unfollow_playlist(playlist_id: "pl_abc") }
        .to raise_error(SpotifyApiError, /Forbidden/)
    end
  end

  describe "proactive token refresh" do
    it "refreshes token before request when token is expired" do
      expired_user = create(:user, token_expires_at: 1.minute.ago)
      expired_client = described_class.new(expired_user)

      token_url = "https://accounts.spotify.com/api/token"

      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("SPOTIFY_CLIENT_ID").and_return("cid")
      allow(ENV).to receive(:[]).with("SPOTIFY_CLIENT_SECRET").and_return("csecret")
      allow(ENV).to receive(:[]).with("SPOTIFY_REDIRECT_URI").and_return("http://localhost:3000/auth/spotify/callback")

      stub_request(:post, token_url)
        .to_return(
          status: 200,
          body: { access_token: "fresh_token", refresh_token: expired_user.refresh_token, expires_in: 3600 }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_request(:get, "#{base_url}/me")
        .with(headers: { "Authorization" => "Bearer fresh_token" })
        .to_return(status: 200, body: { id: "user_123" }.to_json)

      result = expired_client.current_user

      expect(result["id"]).to eq("user_123")
    end
  end
end

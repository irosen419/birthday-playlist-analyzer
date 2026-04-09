require "rails_helper"

RSpec.describe SpotifyAuthService do
  let(:client_id) { "test_client_id" }
  let(:client_secret) { "test_client_secret" }
  let(:redirect_uri) { "http://localhost:3000/auth/spotify/callback" }
  let(:token_url) { "https://accounts.spotify.com/api/token" }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("SPOTIFY_CLIENT_ID").and_return(client_id)
    allow(ENV).to receive(:[]).with("SPOTIFY_CLIENT_SECRET").and_return(client_secret)
    allow(ENV).to receive(:[]).with("SPOTIFY_REDIRECT_URI").and_return(redirect_uri)
  end

  describe ".generate_pkce" do
    it "returns a hash with verifier and challenge keys" do
      pkce = described_class.generate_pkce

      expect(pkce).to have_key(:verifier)
      expect(pkce).to have_key(:challenge)
    end

    it "returns base64url-encoded strings" do
      pkce = described_class.generate_pkce

      expect(pkce[:verifier]).to match(/\A[A-Za-z0-9_-]+\z/)
      expect(pkce[:challenge]).to match(/\A[A-Za-z0-9_-]+\z/)
    end

    it "generates a challenge that is the SHA256 hash of the verifier" do
      pkce = described_class.generate_pkce

      expected_challenge = Base64.urlsafe_encode64(
        Digest::SHA256.digest(pkce[:verifier]), padding: false
      )
      expect(pkce[:challenge]).to eq(expected_challenge)
    end

    it "generates unique verifiers on each call" do
      pkce1 = described_class.generate_pkce
      pkce2 = described_class.generate_pkce

      expect(pkce1[:verifier]).not_to eq(pkce2[:verifier])
    end
  end

  describe ".authorization_url" do
    it "builds a valid Spotify authorization URL" do
      url = described_class.authorization_url(state: "test_state", code_challenge: "test_challenge")

      expect(url).to start_with("https://accounts.spotify.com/authorize?")
    end

    it "includes all required parameters" do
      url = described_class.authorization_url(state: "test_state", code_challenge: "test_challenge")
      uri = URI.parse(url)
      params = Rack::Utils.parse_query(uri.query)

      expect(params["client_id"]).to eq(client_id)
      expect(params["response_type"]).to eq("code")
      expect(params["redirect_uri"]).to eq(redirect_uri)
      expect(params["state"]).to eq("test_state")
      expect(params["code_challenge_method"]).to eq("S256")
      expect(params["code_challenge"]).to eq("test_challenge")
    end

    it "includes all required scopes" do
      url = described_class.authorization_url(state: "s", code_challenge: "c")
      uri = URI.parse(url)
      params = Rack::Utils.parse_query(uri.query)
      scopes = params["scope"].split(" ")

      expect(scopes).to include(
        "user-top-read",
        "playlist-modify-public",
        "playlist-modify-private",
        "streaming",
        "user-read-playback-state",
        "user-modify-playback-state"
      )
    end
  end

  describe ".exchange_code" do
    it "exchanges authorization code for tokens" do
      stub_request(:post, token_url)
        .with(body: hash_including(
          "grant_type" => "authorization_code",
          "code" => "auth_code",
          "code_verifier" => "verifier_123"
        ))
        .to_return(
          status: 200,
          body: {
            access_token: "new_access_token",
            refresh_token: "new_refresh_token",
            expires_in: 3600
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = described_class.exchange_code(code: "auth_code", code_verifier: "verifier_123")

      expect(result[:access_token]).to eq("new_access_token")
      expect(result[:refresh_token]).to eq("new_refresh_token")
      expect(result[:expires_in]).to eq(3600)
    end

    it "sends client credentials in the request body" do
      stub_request(:post, token_url)
        .with(body: hash_including(
          "client_id" => client_id,
          "client_secret" => client_secret
        ))
        .to_return(
          status: 200,
          body: { access_token: "t", refresh_token: "r", expires_in: 3600 }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      described_class.exchange_code(code: "code", code_verifier: "verifier")
    end

    it "raises SpotifyAuthError on error response" do
      stub_request(:post, token_url)
        .to_return(
          status: 400,
          body: { error: "invalid_grant", error_description: "Authorization code expired" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      expect {
        described_class.exchange_code(code: "bad_code", code_verifier: "verifier")
      }.to raise_error(SpotifyAuthError, "Authorization code expired")
    end
  end

  describe ".refresh_tokens" do
    it "refreshes tokens using the refresh token" do
      stub_request(:post, token_url)
        .with(body: hash_including(
          "grant_type" => "refresh_token",
          "refresh_token" => "old_refresh_token"
        ))
        .to_return(
          status: 200,
          body: {
            access_token: "refreshed_access_token",
            refresh_token: "new_refresh_token",
            expires_in: 3600
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = described_class.refresh_tokens(refresh_token: "old_refresh_token")

      expect(result[:access_token]).to eq("refreshed_access_token")
      expect(result[:refresh_token]).to eq("new_refresh_token")
      expect(result[:expires_in]).to eq(3600)
    end

    it "preserves original refresh token when Spotify does not return a new one" do
      stub_request(:post, token_url)
        .to_return(
          status: 200,
          body: {
            access_token: "refreshed_access_token",
            expires_in: 3600
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = described_class.refresh_tokens(refresh_token: "original_refresh_token")

      expect(result[:refresh_token]).to eq("original_refresh_token")
    end

    it "raises SpotifyAuthError on error response" do
      stub_request(:post, token_url)
        .to_return(
          status: 400,
          body: { error: "invalid_grant", error_description: "Refresh token revoked" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      expect {
        described_class.refresh_tokens(refresh_token: "bad_token")
      }.to raise_error(SpotifyAuthError, "Refresh token revoked")
    end
  end
end

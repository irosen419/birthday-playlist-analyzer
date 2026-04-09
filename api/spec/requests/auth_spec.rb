require "rails_helper"

RSpec.describe "Auth", type: :request do
  describe "GET /auth/spotify" do
    it "redirects to Spotify authorization URL" do
      get "/auth/spotify"

      expect(response).to have_http_status(:found)
      expect(response.location).to include("accounts.spotify.com/authorize")
    end

    it "includes PKCE code challenge in redirect URL" do
      get "/auth/spotify"

      expect(response.location).to include("code_challenge=")
      expect(response.location).to include("code_challenge_method=S256")
    end

    it "includes state parameter in redirect URL" do
      get "/auth/spotify"

      expect(response.location).to include("state=")
    end
  end

  describe "GET /auth/spotify/callback" do
    let(:token_response) do
      {
        access_token: "test_access_token",
        refresh_token: "test_refresh_token",
        expires_in: 3600
      }
    end

    let(:spotify_profile) do
      {
        "id" => "spotify_user_123",
        "display_name" => "Test User",
        "email" => "test@example.com"
      }
    end

    before do
      allow(SpotifyAuthService).to receive(:exchange_code).and_return(token_response)
      allow_any_instance_of(SpotifyApiClient).to receive(:current_user).and_return(spotify_profile)
    end

    it "returns 422 when state does not match session" do
      get "/auth/spotify/callback", params: { code: "auth_code", state: "wrong_state" }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "creates a new user on first login" do
      get "/auth/spotify"
      state = extract_state_from(response.location)

      expect {
        get "/auth/spotify/callback", params: { code: "auth_code", state: state }
      }.to change(User, :count).by(1)
    end

    it "updates existing user on subsequent login" do
      user = create(:user, spotify_id: "spotify_user_123")

      get "/auth/spotify"
      state = extract_state_from(response.location)

      expect {
        get "/auth/spotify/callback", params: { code: "auth_code", state: state }
      }.not_to change(User, :count)

      user.reload
      expect(user.display_name).to eq("Test User")
    end

    it "redirects to frontend URL after successful login" do
      get "/auth/spotify"
      state = extract_state_from(response.location)

      get "/auth/spotify/callback", params: { code: "auth_code", state: state }

      expect(response).to have_http_status(:found)
      expect(response.location).to eq("http://localhost:5173")
    end

    it "redirects to custom frontend URL when ENV is set" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("FRONTEND_URL").and_return("https://myapp.com")

      get "/auth/spotify"
      state = extract_state_from(response.location)

      get "/auth/spotify/callback", params: { code: "auth_code", state: state }

      expect(response.location).to eq("https://myapp.com")
    end
  end

  describe "DELETE /auth/logout" do
    let(:user) { create(:user) }

    before { sign_in(user) }

    it "returns success message" do
      delete "/auth/logout"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["message"]).to eq("Logged out")
    end
  end

  private

  def extract_state_from(url)
    query = URI.parse(url).query
    Rack::Utils.parse_query(query)["state"]
  end
end

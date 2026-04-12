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
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("ALLOWED_EMAILS").and_return(nil)
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

    it "redirects to frontend URL with an auth_token after successful login" do
      get "/auth/spotify"
      state = extract_state_from(response.location)

      get "/auth/spotify/callback", params: { code: "auth_code", state: state }

      expect(response).to have_http_status(:found)
      frontend = ENV["FRONTEND_URL"] || "http://localhost:5173"
      expect(response.location).to match(%r{\A#{Regexp.escape(frontend)}\#auth_token=.+\z})
    end

    it "redirects to custom frontend URL when ENV is set" do
      allow(ENV).to receive(:[]).with("FRONTEND_URL").and_return("https://myapp.com")

      get "/auth/spotify"
      state = extract_state_from(response.location)

      get "/auth/spotify/callback", params: { code: "auth_code", state: state }

      expect(response.location).to start_with("https://myapp.com#auth_token=")
    end

    it "generates a valid auth token in the redirect URL" do
      get "/auth/spotify"
      state = extract_state_from(response.location)

      get "/auth/spotify/callback", params: { code: "auth_code", state: state }

      token = extract_auth_token_from(response.location)
      expect(token).to be_present

      created_user = User.find_by(spotify_id: "spotify_user_123")
      expect(AuthTokenService.decode(token)).to eq(created_user.id)
    end

    describe "email allowlist" do
      let(:frontend_url) { ENV["FRONTEND_URL"] || "http://localhost:5173" }

      def stub_allowlist(value)
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("ALLOWED_EMAILS").and_return(value)
      end

      def complete_callback
        get "/auth/spotify"
        state = extract_state_from(response.location)
        get "/auth/spotify/callback", params: { code: "auth_code", state: state }
      end

      context "when the allowlist contains the user's email" do
        before { stub_allowlist("other@example.com,test@example.com,another@example.com") }

        it "creates the user and redirects to the frontend with a token" do
          expect { complete_callback }.to change(User, :count).by(1)

          expect(response).to have_http_status(:found)
          expect(response.location).to start_with("#{frontend_url}#auth_token=")
        end
      end

      context "when the allowlist is present but omits the user's email" do
        before { stub_allowlist("someone@example.com,else@example.com") }

        it "does not create a user" do
          expect { complete_callback }.not_to change(User, :count)
        end

        it "redirects to frontend with an unauthorized error param" do
          complete_callback

          expect(response).to have_http_status(:found)
          expect(response.location).to eq("#{frontend_url}?error=unauthorized")
        end

        it "clears the session" do
          complete_callback

          # A fresh /api/me call should be treated as unauthenticated.
          get "/api/me"
          expect(response).to have_http_status(:unauthorized)
        end
      end

      context "when the allowlist env var is blank" do
        before { stub_allowlist("") }

        it "allows the login" do
          expect { complete_callback }.to change(User, :count).by(1)
          expect(response.location).to start_with("#{frontend_url}#auth_token=")
        end
      end

      context "when the allowlist env var is nil" do
        before { stub_allowlist(nil) }

        it "allows the login" do
          expect { complete_callback }.to change(User, :count).by(1)
          expect(response.location).to start_with("#{frontend_url}#auth_token=")
        end
      end

      context "when the allowlist contains whitespace and mixed case" do
        before { stub_allowlist(" Other@example.com , TEST@example.com ") }

        it "matches case-insensitively and ignores surrounding whitespace" do
          expect { complete_callback }.to change(User, :count).by(1)
          expect(response.location).to start_with("#{frontend_url}#auth_token=")
        end
      end
    end
    context "when FRONTEND_URL contains a stray fragment" do
      it "produces a clean auth_token fragment without doubling the #" do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("FRONTEND_URL").and_return("https://myapp.com/#")
        allow(ENV).to receive(:[]).with("ALLOWED_EMAILS").and_return(nil)

        get "/auth/spotify"
        state = extract_state_from(response.location)
        get "/auth/spotify/callback", params: { code: "auth_code", state: state }

        expect(response.location).to match(%r{\Ahttps://myapp\.com/\#auth_token=.+\z})
        expect(response.location).not_to include("##")
      end
    end
  end

  private

  def extract_state_from(url)
    query = URI.parse(url).query
    Rack::Utils.parse_query(query)["state"]
  end

  def extract_auth_token_from(url)
    fragment = URI.parse(url).fragment
    Rack::Utils.parse_query(fragment)["auth_token"]
  end
end

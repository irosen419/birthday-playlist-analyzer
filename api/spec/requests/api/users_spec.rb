require "rails_helper"

RSpec.describe "Api::Users", type: :request do
  let(:user) { create(:user, display_name: "DJ Test", email: "dj@test.com", birth_year: 1991) }

  describe "GET /api/me" do
    context "when authenticated" do
      before { sign_in(user) }

      it "returns current user profile" do
        get "/api/me"

        expect(response).to have_http_status(:ok)
        body = response.parsed_body
        expect(body["id"]).to eq(user.id)
        expect(body["spotify_id"]).to eq(user.spotify_id)
        expect(body["display_name"]).to eq("DJ Test")
        expect(body["email"]).to eq("dj@test.com")
        expect(body["birth_year"]).to eq(1991)
      end

      it "includes setup_completed in the response" do
        get "/api/me"

        body = response.parsed_body
        expect(body).to have_key("setup_completed")
        expect(body["setup_completed"]).to be false
      end

      it "returns setup_completed as true when user has completed setup" do
        user.update!(setup_completed: true)
        get "/api/me"

        expect(response.parsed_body["setup_completed"]).to be true
      end

      it "does not expose sensitive token fields" do
        get "/api/me"

        body = response.parsed_body
        expect(body).not_to have_key("access_token")
        expect(body).not_to have_key("refresh_token")
        expect(body).not_to have_key("access_token_ciphertext")
        expect(body).not_to have_key("refresh_token_ciphertext")
      end
    end

    context "when not authenticated" do
      it "returns 401" do
        get "/api/me"

        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["error"]).to eq("Unauthorized")
      end
    end

    context "with bearer token authentication" do
      it "returns 200 and user data when given a valid Bearer token" do
        get "/api/me", headers: auth_headers(user)

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["id"]).to eq(user.id)
        expect(response.parsed_body["email"]).to eq("dj@test.com")
      end

      it "returns 401 when no Authorization header is present" do
        get "/api/me"

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when the Bearer token is invalid" do
        get "/api/me", headers: { "Authorization" => "Bearer not-a-valid-token" }

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when the Bearer token is expired" do
        headers = auth_headers(user)

        travel_to(AuthTokenService::EXPIRY.from_now + 1.minute) do
          get "/api/me", headers: headers
        end

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when Authorization header uses a non-Bearer scheme" do
        get "/api/me", headers: { "Authorization" => "Basic foo" }

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when Bearer token is empty" do
        get "/api/me", headers: { "Authorization" => "Bearer " }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "PATCH /api/me" do
    before { sign_in(user) }

    it "updates birth_year" do
      patch "/api/me", params: { birth_year: 1985 }

      expect(response).to have_http_status(:ok)
      expect(user.reload.birth_year).to eq(1985)
      expect(response.parsed_body["birth_year"]).to eq(1985)
    end

    it "updates display_name" do
      patch "/api/me", params: { display_name: "New Name" }

      expect(response).to have_http_status(:ok)
      expect(user.reload.display_name).to eq("New Name")
      expect(response.parsed_body["display_name"]).to eq("New Name")
    end

    it "updates setup_completed" do
      patch "/api/me", params: { setup_completed: true }

      expect(response).to have_http_status(:ok)
      expect(user.reload.setup_completed).to be true
      expect(response.parsed_body["setup_completed"]).to be true
    end

    it "updates birth_year and setup_completed together during onboarding" do
      patch "/api/me", params: { birth_year: 1990, setup_completed: true }

      expect(response).to have_http_status(:ok)
      user.reload
      expect(user.birth_year).to eq(1990)
      expect(user.setup_completed).to be true
    end

    it "does not allow updating spotify_id" do
      original_spotify_id = user.spotify_id
      patch "/api/me", params: { spotify_id: "hacked" }

      expect(user.reload.spotify_id).to eq(original_spotify_id)
    end

    it "does not allow updating email" do
      original_email = user.email
      patch "/api/me", params: { email: "hacked@evil.com" }

      expect(user.reload.email).to eq(original_email)
    end
  end

  describe "GET /api/token" do
    before { sign_in(user) }

    it "returns access token" do
      get "/api/token"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["access_token"]).to eq(user.access_token)
    end
  end
end

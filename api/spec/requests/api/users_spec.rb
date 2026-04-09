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
  end

  describe "PATCH /api/me" do
    before { sign_in(user) }

    it "updates birth_year" do
      patch "/api/me", params: { birth_year: 1985 }

      expect(response).to have_http_status(:ok)
      expect(user.reload.birth_year).to eq(1985)
      expect(response.parsed_body["birth_year"]).to eq(1985)
    end

    it "does not allow updating spotify_id" do
      original_spotify_id = user.spotify_id
      patch "/api/me", params: { spotify_id: "hacked" }

      expect(user.reload.spotify_id).to eq(original_spotify_id)
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

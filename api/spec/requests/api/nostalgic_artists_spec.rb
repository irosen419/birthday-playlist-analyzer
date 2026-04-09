require "rails_helper"

RSpec.describe "Api::NostalgicArtists", type: :request do
  let(:user) { create(:user) }

  before { sign_in(user) }

  describe "GET /api/nostalgic_artists" do
    it "returns the current user's nostalgic artists" do
      get "/api/nostalgic_artists"

      expect(response).to have_http_status(:ok)
      names = response.parsed_body.map { |a| a["name"] }
      expect(names).to include("NSYNC")
    end

    it "does not return other users' artists" do
      other_user = create(:user)
      create(:nostalgic_artist, user: other_user, name: "Secret Artist")

      get "/api/nostalgic_artists"

      names = response.parsed_body.map { |a| a["name"] }
      expect(names).not_to include("Secret Artist")
    end
  end

  describe "POST /api/nostalgic_artists" do
    it "creates a nostalgic artist" do
      expect {
        post "/api/nostalgic_artists", params: { name: "Destiny's Child", era: "formative" }
      }.to change(user.nostalgic_artists, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body["name"]).to eq("Destiny's Child")
      expect(response.parsed_body["era"]).to eq("formative")
    end

    it "returns errors for invalid params" do
      post "/api/nostalgic_artists", params: { name: "", era: "formative" }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns errors for invalid era" do
      post "/api/nostalgic_artists", params: { name: "Test", era: "invalid" }

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "DELETE /api/nostalgic_artists/:id" do
    it "destroys the artist" do
      artist = create(:nostalgic_artist, user: user)

      expect {
        delete "/api/nostalgic_artists/#{artist.id}"
      }.to change(user.nostalgic_artists, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end

    it "cannot destroy another user's artist" do
      other_user = create(:user)
      artist = create(:nostalgic_artist, user: other_user)

      expect {
        delete "/api/nostalgic_artists/#{artist.id}"
      }.not_to change(NostalgicArtist, :count)

      expect(response).to have_http_status(:not_found)
    end
  end
end

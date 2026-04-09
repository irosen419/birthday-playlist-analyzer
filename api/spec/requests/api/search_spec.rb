require "rails_helper"

RSpec.describe "Api::Search", type: :request do
  let(:user) { create(:user) }

  before { sign_in(user) }

  describe "GET /api/search" do
    let(:spotify_response) do
      {
        "tracks" => {
          "items" => [
            {
              "id" => "track1",
              "name" => "Found Track",
              "artists" => [{ "id" => "a1", "name" => "Found Artist" }],
              "album" => { "name" => "Found Album", "images" => [{ "url" => "https://img.com/1.jpg" }] },
              "duration_ms" => 200_000,
              "uri" => "spotify:track:track1",
              "popularity" => 75,
              "preview_url" => "https://preview.com/1"
            }
          ]
        }
      }
    end

    before do
      allow_any_instance_of(SpotifyApiClient).to receive(:search).and_return(spotify_response)
    end

    it "returns simplified track results" do
      get "/api/search", params: { q: "test query" }

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["tracks"].length).to eq(1)
      track = body["tracks"].first
      expect(track["id"]).to eq("track1")
      expect(track["name"]).to eq("Found Track")
      expect(track["artists"]).to be_present
      expect(track["album"]).to be_present
    end

    it "returns 400 when q param is missing" do
      get "/api/search"

      expect(response).to have_http_status(:bad_request)
    end
  end
end

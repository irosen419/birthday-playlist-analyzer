require "rails_helper"

RSpec.describe "Api::Player", type: :request do
  let(:user) { create(:user) }

  before do
    sign_in(user)
    stub_request(:any, /api.spotify.com/).to_return(status: 204, body: "")
  end

  describe "POST /api/player/play" do
    it "proxies play request to Spotify" do
      stub = stub_request(:put, "https://api.spotify.com/v1/me/player/play")
        .with(query: hash_including("device_id" => "device123"))
        .to_return(status: 204)

      post "/api/player/play", params: { device_id: "device123", uris: ["spotify:track:abc"] }, as: :json

      expect(response).to have_http_status(:no_content)
      expect(stub).to have_been_requested
    end
  end

  describe "POST /api/player/pause" do
    it "proxies pause request to Spotify" do
      stub = stub_request(:put, "https://api.spotify.com/v1/me/player/pause")
        .with(query: hash_including("device_id" => "device123"))
        .to_return(status: 204)

      post "/api/player/pause", params: { device_id: "device123" }, as: :json

      expect(response).to have_http_status(:no_content)
      expect(stub).to have_been_requested
    end
  end

  describe "POST /api/player/next" do
    it "proxies next request to Spotify" do
      stub = stub_request(:post, "https://api.spotify.com/v1/me/player/next")
        .with(query: hash_including("device_id" => "device123"))
        .to_return(status: 204)

      post "/api/player/next", params: { device_id: "device123" }, as: :json

      expect(response).to have_http_status(:no_content)
      expect(stub).to have_been_requested
    end
  end

  describe "POST /api/player/previous" do
    it "proxies previous request to Spotify" do
      stub = stub_request(:post, "https://api.spotify.com/v1/me/player/previous")
        .with(query: hash_including("device_id" => "device123"))
        .to_return(status: 204)

      post "/api/player/previous", params: { device_id: "device123" }, as: :json

      expect(response).to have_http_status(:no_content)
      expect(stub).to have_been_requested
    end
  end
end

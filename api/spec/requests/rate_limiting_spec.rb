require "rails_helper"

RSpec.describe "Rate limiting", type: :request do
  before do
    Rack::Attack.enabled = true
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    Rack::Attack.reset!
  end

  after do
    Rack::Attack.cache.store.clear
    Rack::Attack.enabled = false
  end

  def get_from_ip(path, ip, params: {})
    get path, params: params, headers: { "REMOTE_ADDR" => ip }
  end

  describe "general request throttling" do
    let(:ip) { "1.2.3.4" }

    it "allows up to 100 requests per minute per IP" do
      100.times do
        get_from_ip("/up", ip)
        expect(response).not_to have_http_status(:too_many_requests)
      end
    end

    it "throttles the 101st request within one minute" do
      100.times { get_from_ip("/up", ip) }

      get_from_ip("/up", ip)

      expect(response).to have_http_status(:too_many_requests)
    end

    it "returns a JSON error body when throttled" do
      101.times { get_from_ip("/up", ip) }

      expect(response.parsed_body).to eq("error" => "Too many requests. Please try again later.")
      expect(response.content_type).to include("application/json")
    end

    it "isolates throttles by IP" do
      100.times { get_from_ip("/up", "9.9.9.9") }

      get_from_ip("/up", "8.8.8.8")

      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  describe "generate endpoint throttling" do
    let(:ip) { "5.6.7.8" }
    let(:path) { "/api/playlists/42/generate" }

    it "allows up to 5 generate requests per minute per IP" do
      5.times do
        post path, headers: { "REMOTE_ADDR" => ip }
        expect(response).not_to have_http_status(:too_many_requests)
      end
    end

    it "throttles the 6th generate request within one minute" do
      5.times { post path, headers: { "REMOTE_ADDR" => ip } }

      post path, headers: { "REMOTE_ADDR" => ip }

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "search endpoint throttling" do
    let(:ip) { "10.20.30.40" }
    let(:path) { "/api/search" }

    it "allows up to 30 search requests per minute per IP" do
      30.times do
        get_from_ip(path, ip, params: { q: "test" })
        expect(response).not_to have_http_status(:too_many_requests)
      end
    end

    it "throttles the 31st search request within one minute" do
      30.times { get_from_ip(path, ip, params: { q: "test" }) }

      get_from_ip(path, ip, params: { q: "test" })

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "auth callback throttling" do
    let(:ip) { "11.22.33.44" }
    let(:path) { "/auth/spotify/callback" }

    it "allows up to 10 auth callback requests per 5 minutes per IP" do
      10.times do
        get_from_ip(path, ip, params: { code: "x", state: "y" })
        expect(response).not_to have_http_status(:too_many_requests)
      end
    end

    it "throttles the 11th auth callback request within 5 minutes" do
      10.times { get_from_ip(path, ip, params: { code: "x", state: "y" }) }

      get_from_ip(path, ip, params: { code: "x", state: "y" })

      expect(response).to have_http_status(:too_many_requests)
    end
  end
end

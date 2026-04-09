module Api
  class PlayerController < ApplicationController
    before_action :authenticate_user!

    SPOTIFY_PLAYER_URL = "https://api.spotify.com/v1/me/player"

    def play
      spotify_put("#{SPOTIFY_PLAYER_URL}/play", play_body)
      head :no_content
    end

    def pause
      spotify_put("#{SPOTIFY_PLAYER_URL}/pause")
      head :no_content
    end

    def next
      spotify_post("#{SPOTIFY_PLAYER_URL}/next")
      head :no_content
    end

    def previous
      spotify_post("#{SPOTIFY_PLAYER_URL}/previous")
      head :no_content
    end

    private

    def spotify_put(url, body = nil)
      connection.put(url) do |req|
        req.headers["Authorization"] = "Bearer #{current_user.access_token}"
        req.params["device_id"] = params[:device_id] if params[:device_id]
        if body
          req.headers["Content-Type"] = "application/json"
          req.body = body.to_json
        end
      end
    end

    def spotify_post(url)
      connection.post(url) do |req|
        req.headers["Authorization"] = "Bearer #{current_user.access_token}"
        req.params["device_id"] = params[:device_id] if params[:device_id]
      end
    end

    def play_body
      body = {}
      body[:uris] = params[:uris] if params[:uris]
      body[:context_uri] = params[:context_uri] if params[:context_uri]
      body[:offset] = params[:offset] if params[:offset]
      body.presence
    end

    def connection
      @connection ||= Faraday.new
    end
  end
end

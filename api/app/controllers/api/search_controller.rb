module Api
  class SearchController < ApplicationController
    before_action :authenticate_user!

    def index
      unless params[:q].present?
        render json: { error: "Query parameter 'q' is required" }, status: :bad_request
        return
      end

      search_type = params[:type] == "artist" ? "artist" : "track"
      results = spotify_client.search(query: params[:q], types: [search_type], limit: params[:limit]&.to_i || 20)

      if search_type == "artist"
        artists = (results.dig("artists", "items") || []).map { |a| simplify_artist(a) }
        render json: { artists: artists }
      else
        tracks = (results.dig("tracks", "items") || []).map { |t| simplify_track(t) }
        render json: { tracks: tracks }
      end
    end

    private

    def simplify_track(track)
      {
        id: track["id"],
        name: track["name"],
        artists: (track["artists"] || []).map { |a| { id: a["id"], name: a["name"] } },
        album: {
          name: track.dig("album", "name"),
          images: track.dig("album", "images") || []
        },
        duration_ms: track["duration_ms"],
        uri: track["uri"],
        popularity: track["popularity"],
        preview_url: track["preview_url"]
      }
    end

    def simplify_artist(artist)
      {
        id: artist["id"],
        name: artist["name"],
        images: artist["images"] || [],
        genres: (artist["genres"] || []).first(3),
        popularity: artist["popularity"]
      }
    end
  end
end

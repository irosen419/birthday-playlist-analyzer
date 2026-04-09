module Api
  class AnalysisController < ApplicationController
    before_action :authenticate_user!

    RANKED_ARTIST_LIMIT = 50
    RANKED_TRACK_LIMIT = 50
    CONSISTENT_FAVORITE_LIMIT = 20

    def show
      analyzer = TopItemsAnalyzer.new(spotify_client)
      result = analyzer.analyze
      analysis = result[:analysis]

      render json: {
        artists: format_artist_analysis(analysis[:artists]),
        tracks: format_track_analysis(analysis[:tracks])
      }
    end

    private

    def format_artist_analysis(data)
      {
        topGenres: data[:top_genres],
        rankedArtists: data[:ranked_artists].first(RANKED_ARTIST_LIMIT).map { |a| simplify_artist(a) },
        consistentFavorites: data[:consistent_favorites].first(CONSISTENT_FAVORITE_LIMIT).map { |a| simplify_artist(a) },
        totalUniqueArtists: data[:total_unique_artists]
      }
    end

    def format_track_analysis(data)
      {
        rankedTracks: data[:ranked_tracks].first(RANKED_TRACK_LIMIT).map { |t| simplify_track(t) },
        consistentFavorites: data[:consistent_favorites].first(CONSISTENT_FAVORITE_LIMIT).map { |t| simplify_track(t) },
        totalUniqueTracks: data[:total_unique_tracks]
      }
    end

    def simplify_artist(artist)
      {
        id: artist["id"],
        name: artist["name"],
        genres: artist["genres"],
        images: artist["images"],
        popularity: artist["popularity"],
        totalWeight: artist["total_weight"],
        timeRanges: artist["time_ranges"]
      }
    end

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
        popularity: track["popularity"]
      }
    end
  end
end

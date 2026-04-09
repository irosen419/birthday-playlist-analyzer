class TopItemsAnalyzer
  TIME_RANGES = %w[short_term medium_term long_term].freeze
  MAX_TOP_GENRES = 20

  def initialize(spotify_client)
    @client = spotify_client
  end

  def analyze
    top_artists = fetch_top_artists
    top_tracks = fetch_top_tracks

    artist_analysis = analyze_artists(top_artists)
    track_analysis = analyze_tracks(top_tracks)

    {
      raw: { top_artists: top_artists, top_tracks: top_tracks },
      analysis: { artists: artist_analysis, tracks: track_analysis }
    }
  end

  def analyze_artists(artists_by_time_range)
    genre_counts = Hash.new(0.0)
    all_artists = {}

    artists_by_time_range.each do |time_range, artists|
      artists.each_with_index do |artist, position|
        weight = calculate_weight(position, artists.length)
        artist_id = artist["id"]

        all_artists[artist_id] ||= artist.merge("time_ranges" => [], "total_weight" => 0.0)
        all_artists[artist_id]["time_ranges"] << time_range
        all_artists[artist_id]["total_weight"] += weight

        (artist["genres"] || []).each do |genre|
          genre_counts[genre] += weight
        end
      end
    end

    top_genres = genre_counts
      .sort_by { |_, weight| -weight }
      .first(MAX_TOP_GENRES)
      .map { |genre, weight| { genre: genre, weight: weight.round(2) } }

    ranked_artists = all_artists.values.sort_by { |a| -a["total_weight"] }

    consistent_favorites = ranked_artists.select do |artist|
      artist["time_ranges"].length == TIME_RANGES.length
    end

    {
      top_genres: top_genres,
      ranked_artists: ranked_artists,
      consistent_favorites: consistent_favorites,
      total_unique_artists: all_artists.size
    }
  end

  def analyze_tracks(tracks_by_time_range)
    all_tracks = {}
    artist_track_counts = Hash.new(0)

    tracks_by_time_range.each do |time_range, tracks|
      tracks.each_with_index do |track, position|
        weight = calculate_weight(position, tracks.length)
        track_id = track["id"]

        all_tracks[track_id] ||= track.merge("time_ranges" => [], "total_weight" => 0.0)
        all_tracks[track_id]["time_ranges"] << time_range
        all_tracks[track_id]["total_weight"] += weight

        (track["artists"] || []).each do |artist|
          artist_track_counts[artist["id"]] += 1
        end
      end
    end

    ranked_tracks = all_tracks.values.sort_by { |t| -t["total_weight"] }

    consistent_favorites = ranked_tracks.select do |track|
      track["time_ranges"].length == TIME_RANGES.length
    end

    {
      ranked_tracks: ranked_tracks,
      consistent_favorites: consistent_favorites,
      total_unique_tracks: all_tracks.size,
      artist_track_counts: artist_track_counts
    }
  end

  def calculate_weight(position, total)
    1.0 - (position.to_f / total) * 0.9
  end

  private

  def fetch_top_artists
    TIME_RANGES.each_with_object({}) do |time_range, results|
      data = @client.top_artists(time_range: time_range, limit: 50)
      results[time_range] = data["items"]
    end
  end

  def fetch_top_tracks
    TIME_RANGES.each_with_object({}) do |time_range, results|
      data = @client.top_tracks(time_range: time_range, limit: 50)
      results[time_range] = data["items"]
    end
  end
end

class PlaylistGeneratorService
  TARGET_SONG_COUNT = 125
  FAVORITES_RATIO = 0.3
  GENRE_DISCOVERY_RATIO = 0.3
  MIN_POPULARITY = 60
  MAX_PER_ARTIST = 3
  SEARCH_GENRES = ["pop", "rock", "hip hop", "r&b"].freeze

  def initialize(user, spotify_client)
    @user = user
    @client = spotify_client
  end

  def generate(analysis_data, birth_year:, target_count: TARGET_SONG_COUNT, exclude_track_ids: [])
    favorites_count = (target_count * FAVORITES_RATIO).floor
    genre_discovery_count = (target_count * GENRE_DISCOVERY_RATIO).floor
    era_hits_count = target_count - favorites_count - genre_discovery_count

    all_track_ids = Set.new(exclude_track_ids)

    favorites = select_favorites(analysis_data[:tracks][:ranked_tracks], favorites_count, all_track_ids)
    favorites.each { |t| all_track_ids.add(t["id"]) }

    genre_discoveries = get_genre_discoveries(
      analysis_data[:artists][:ranked_artists], genre_discovery_count, all_track_ids
    )
    genre_discoveries.each { |t| all_track_ids.add(t["id"]) }

    era_hits = get_era_hits(birth_year, era_hits_count, all_track_ids)
    era_hits.each { |t| all_track_ids.add(t["id"]) }

    all_tracks = intelligent_shuffle(favorites, genre_discoveries, era_hits)

    {
      tracks: all_tracks,
      favorites: favorites,
      genre_discoveries: genre_discoveries,
      era_hits: era_hits,
      stats: {
        total_tracks: all_tracks.length,
        from_favorites: favorites.length,
        from_genre_discovery: genre_discoveries.length,
        from_era_hits: era_hits.length,
        birth_year: birth_year
      }
    }
  end

  def select_favorites(ranked_tracks, target_count, exclude_ids = Set.new)
    scored_tracks = ranked_tracks.reject { |t| exclude_ids.include?(t["id"]) }.map do |track|
      popularity = (track["popularity"] || 50) / 100.0
      score = track["total_weight"] * 0.8 + popularity * 0.2
      track.merge("score" => score)
    end.sort_by { |t| -t["score"] }

    selected = []
    artist_counts = Hash.new(0)

    scored_tracks.each do |track|
      break if selected.length >= target_count

      artist_id = track.dig("artists", 0, "id")
      next if artist_counts[artist_id] >= MAX_PER_ARTIST

      selected << track.merge("source" => "favorite")
      artist_counts[artist_id] += 1
    end

    selected
  end

  def get_genre_discoveries(ranked_artists, target_count, exclude_track_ids)
    discoveries = []
    seen_track_ids = Set.new(exclude_track_ids)
    top_50_artist_ids = Set.new(ranked_artists.first(50).map { |a| a["id"] })

    user_genres = EraCalculator.extract_genres(ranked_artists, 50)
    all_genres = EraCalculator.expand_genres(user_genres)

    all_genres.first(10).each do |genre|
      break if discoveries.length >= target_count

      search_results = safe_search("genre:\"#{genre}\"")
      eligible = filter_eligible_tracks(
        search_results, seen_track_ids, top_50_artist_ids
      ).first(3)

      eligible.each do |track|
        break if discoveries.length >= target_count
        discoveries << track.merge("source" => "genre_discovery", "discovery_genre" => genre)
        seen_track_ids.add(track["id"])
      end
    end

    fill_with_recommendations(discoveries, target_count, seen_track_ids, top_50_artist_ids, all_genres)

    discoveries
  end

  def get_era_hits(birth_year, target_count, exclude_track_ids)
    era_ranges = EraCalculator.calculate_era_ranges(birth_year)
    distribution = EraCalculator.distribute_era_track_count(target_count)
    era_hits = []
    seen_track_ids = Set.new(exclude_track_ids)

    era_ranges.each do |era|
      era_target = distribution[era[:name].to_sym]
      next if era_target.nil? || era_target.zero?

      era_tracks = search_era_hits(era, era_target, seen_track_ids)
      era_tracks.each do |track|
        era_hits << track
        seen_track_ids.add(track["id"])
      end
    end

    era_hits
  end

  def intelligent_shuffle(favorites, genre_discoveries, era_hits)
    combined = []
    fav_idx = 0
    genre_idx = 0
    era_idx = 0

    while fav_idx < favorites.length || genre_idx < genre_discoveries.length || era_idx < era_hits.length
      2.times do
        break if fav_idx >= favorites.length
        combined << favorites[fav_idx]
        fav_idx += 1
      end

      2.times do
        break if genre_idx >= genre_discoveries.length
        combined << genre_discoveries[genre_idx]
        genre_idx += 1
      end

      2.times do
        break if era_idx >= era_hits.length
        combined << era_hits[era_idx]
        era_idx += 1
      end
    end

    light_shuffle(combined, 6)
  end

  def light_shuffle(tracks, group_size)
    result = []

    tracks.each_slice(group_size) do |group|
      shuffled = group.dup
      (shuffled.length - 1).downto(1) do |j|
        k = rand(j + 1)
        shuffled[j], shuffled[k] = shuffled[k], shuffled[j]
      end
      result.concat(shuffled)
    end

    result
  end

  private

  def search_era_hits(era, target_count, seen_track_ids)
    tracks = []

    if era[:name] == "formative"
      tracks.concat(fetch_nostalgic_artist_tracks(target_count, seen_track_ids))
    end

    return tracks if tracks.length >= target_count

    SEARCH_GENRES.each do |genre|
      break if tracks.length >= target_count

      query = "year:#{era[:year_range]} genre:#{genre}"
      search_results = safe_search(query)
      remaining = target_count - tracks.length
      per_genre = (remaining.to_f / (SEARCH_GENRES.length)).ceil

      eligible = search_results
        .reject { |t| seen_track_ids.include?(t["id"]) }
        .select { |t| (t["popularity"] || 0) >= MIN_POPULARITY }
        .first(per_genre)

      eligible.each do |track|
        break if tracks.length >= target_count
        tracks << track.merge("source" => "era_hit", "era" => era[:name])
        seen_track_ids.add(track["id"])
      end
    end

    tracks
  end

  def fetch_nostalgic_artist_tracks(target_count, seen_track_ids)
    tracks = []
    nostalgic_artists = @user.nostalgic_artists.where(era: "formative")

    nostalgic_artists.each do |nostalgic_artist|
      break if tracks.length >= target_count

      search_results = @client.search(query: nostalgic_artist.name, types: ["artist"], limit: 5)
      artist = search_results.dig("artists", "items", 0)
      next unless artist

      top_tracks = @client.artist_top_tracks(artist_id: artist["id"])
      eligible = (top_tracks["tracks"] || [])
        .reject { |t| seen_track_ids.include?(t["id"]) }
        .select { |t| (t["popularity"] || 0) >= MIN_POPULARITY }
        .first(2)

      eligible.each do |track|
        break if tracks.length >= target_count
        tracks << track.merge(
          "source" => "era_hit",
          "era" => "formative",
          "nostalgic" => true,
          "nostalgic_artist" => nostalgic_artist.name
        )
        seen_track_ids.add(track["id"])
      end
    end

    tracks
  end

  def safe_search(query)
    result = @client.search(query: query, types: ["track"], limit: 20)
    result.dig("tracks", "items") || []
  rescue SpotifyApiError
    []
  end

  def filter_eligible_tracks(tracks, seen_track_ids, top_50_artist_ids)
    tracks
      .reject { |t| seen_track_ids.include?(t["id"]) }
      .select { |t| (t["popularity"] || 0) >= MIN_POPULARITY }
      .reject { |t| top_50_artist_ids.include?(t.dig("artists", 0, "id")) }
  end

  def fill_with_recommendations(discoveries, target_count, seen_track_ids, top_50_artist_ids, all_genres)
    return if discoveries.length >= target_count

    seed_genres = all_genres.first(5)
    recs = begin
      @client.get_recommendations(
        seed_genres: seed_genres,
        min_popularity: MIN_POPULARITY,
        limit: [target_count - discoveries.length + 10, 100].min
      )
    rescue SpotifyApiError
      { "tracks" => [] }
    end

    eligible = (recs["tracks"] || [])
      .reject { |t| seen_track_ids.include?(t["id"]) }
      .reject { |t| top_50_artist_ids.include?(t.dig("artists", 0, "id")) }

    eligible.each do |track|
      break if discoveries.length >= target_count
      discoveries << track.merge("source" => "genre_recommendation")
      seen_track_ids.add(track["id"])
    end
  end
end

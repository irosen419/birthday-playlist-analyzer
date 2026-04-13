class PlaylistGeneratorService
  DEFAULT_TARGET_SONG_COUNT = 125
  DEFAULT_FAVORITES_RATIO = 0.3
  DEFAULT_DISCOVERY_RATIO = 0.3
  MIN_POPULARITY = 60
  MAX_PER_ARTIST = 3
  GLOBAL_MAX_PER_ARTIST = 4
  NOSTALGIC_PER_ARTIST_TARGET = 4
  NOSTALGIC_POPULARITY_TIERS = [60, 30, 0].freeze
  NOSTALGIC_ERA_SHARE = 0.5
  SEARCH_GENRES = ["pop", "rock", "hip hop", "r&b"].freeze
  MAX_SEARCH_OFFSET = 80
  SCORE_JITTER_RANGE = 0.15
  GENRE_SAMPLE_SIZE = 10

  def initialize(user, spotify_client)
    @user = user
    @client = spotify_client
  end

  def generate(analysis_data, birth_year:, target_count: DEFAULT_TARGET_SONG_COUNT,
               exclude_track_ids: [],
               existing_tracks: [],
               favorites_ratio: DEFAULT_FAVORITES_RATIO,
               discovery_ratio: DEFAULT_DISCOVERY_RATIO,
               era_hits_ratio: nil)
    favorites_count = (target_count * favorites_ratio).floor
    genre_discovery_count = (target_count * discovery_ratio).floor
    era_hits_count = target_count - favorites_count - genre_discovery_count

    all_track_ids = Set.new(exclude_track_ids)
    @seen_signatures = Set.new
    @artist_counts = seed_artist_counts(existing_tracks)

    favorites = apply_global_cap(
      select_favorites(analysis_data[:tracks][:ranked_tracks], favorites_count, all_track_ids)
    )
    favorites.each { |t| mark_seen(t, all_track_ids) }

    genre_discoveries = apply_global_cap(
      get_genre_discoveries(
        analysis_data[:artists][:ranked_artists], genre_discovery_count, all_track_ids
      )
    )
    genre_discoveries.each { |t| mark_seen(t, all_track_ids) }

    era_hits = apply_global_cap(get_era_hits(birth_year, era_hits_count, all_track_ids))
    era_hits.each { |t| mark_seen(t, all_track_ids) }

    all_tracks = intelligent_shuffle(favorites, genre_discoveries, era_hits)
    reconciled = reconcile_to_target(
      all_tracks, target_count, analysis_data[:tracks][:ranked_tracks], all_track_ids
    )

    {
      tracks: reconciled[:tracks],
      favorites: favorites,
      genre_discoveries: genre_discoveries,
      era_hits: era_hits,
      stats: {
        total_tracks: reconciled[:tracks].length,
        from_favorites: favorites.length,
        from_genre_discovery: genre_discoveries.length,
        from_era_hits: era_hits.length,
        from_reconciliation: reconciled[:extras].length,
        birth_year: birth_year
      }
    }
  end

  def select_favorites(ranked_tracks, target_count, exclude_ids = Set.new)
    scored_tracks = ranked_tracks.reject { |t| exclude_ids.include?(t["id"]) }.map do |track|
      popularity = (track["popularity"] || 50) / 100.0
      base_score = track["total_weight"] * 0.8 + popularity * 0.2
      jitter = rand * SCORE_JITTER_RANGE - (SCORE_JITTER_RANGE / 2.0)
      track.merge("score" => base_score + jitter)
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

    sampled_genres = weighted_sample(all_genres, GENRE_SAMPLE_SIZE)

    sampled_genres.each do |genre|
      break if discoveries.length >= target_count

      offset = rand(0..MAX_SEARCH_OFFSET)
      search_results = safe_search("genre:\"#{genre}\"", offset: offset)
      eligible = filter_eligible_tracks(
        search_results, seen_track_ids, top_50_artist_ids
      ).first(3)

      eligible.each do |track|
        break if discoveries.length >= target_count
        discoveries << track.merge("source" => "genre_discovery", "discovery_genre" => genre)
        mark_seen(track, seen_track_ids)
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

    nostalgic_budget = (target_count * NOSTALGIC_ERA_SHARE).ceil
    nostalgic_tracks = fetch_nostalgic_artist_tracks(nostalgic_budget, seen_track_ids)
    nostalgic_tracks.each do |track|
      era_hits << track
      mark_seen(track, seen_track_ids)
    end

    era_ranges.each do |era|
      era_target = distribution[era[:name].to_sym]
      next if era_target.nil? || era_target.zero?
      break if era_hits.length >= target_count

      era_tracks = search_era_hits(era, era_target, seen_track_ids)
      era_tracks.each do |track|
        break if era_hits.length >= target_count
        era_hits << track
        mark_seen(track, seen_track_ids)
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

  def seed_artist_counts(existing_tracks)
    counts = Hash.new(0)
    (existing_tracks || []).each do |track|
      key = primary_artist_key(track)
      counts[key] += 1 if key
    end
    counts
  end

  # Primary artist key used for the global cap. Uses normalized primary artist NAME
  # (not id) so that seeded DB tracks — which only persist artist names — use the
  # same key as fresh Spotify API candidates.
  def primary_artist_key(track)
    name = track.dig("artists", 0, "name") || track.dig(:artists, 0, :name)
    return nil if name.blank?
    name.to_s.downcase.strip
  end

  def apply_global_cap(tracks)
    return tracks if @artist_counts.nil?

    tracks.select do |track|
      key = primary_artist_key(track)
      if key.nil?
        true
      elsif @artist_counts[key] >= GLOBAL_MAX_PER_ARTIST
        false
      else
        @artist_counts[key] += 1
        true
      end
    end
  end

  def reconcile_to_target(all_tracks, target_count, ranked_tracks, used_ids)
    if all_tracks.length > target_count
      return { tracks: all_tracks.first(target_count), extras: [] }
    end

    shortfall = target_count - all_tracks.length
    return { tracks: all_tracks, extras: [] } if shortfall.zero?

    extras = collect_overfetch_extras(ranked_tracks, shortfall, used_ids)
    { tracks: all_tracks + extras, extras: extras }
  end

  def collect_overfetch_extras(ranked_tracks, needed, used_ids)
    extras = []

    ranked_tracks.each do |track|
      break if extras.length >= needed
      next if used_ids.include?(track["id"])
      next if duplicate_signature?(track)

      key = primary_artist_key(track)
      next if key && @artist_counts[key] >= GLOBAL_MAX_PER_ARTIST

      extras << track.merge("source" => "reconciliation")
      mark_seen(track, used_ids)
      @artist_counts[key] += 1 if key
    end

    extras
  end

  def search_era_hits(era, target_count, seen_track_ids)
    tracks = []
    shuffled_genres = SEARCH_GENRES.shuffle

    shuffled_genres.each do |genre|
      break if tracks.length >= target_count

      offset = rand(0..MAX_SEARCH_OFFSET)
      query = "year:#{era[:year_range]} genre:#{genre}"
      search_results = safe_search(query, offset: offset)
      remaining = target_count - tracks.length
      per_genre = (remaining.to_f / (shuffled_genres.length)).ceil

      eligible = search_results
        .reject { |t| seen_track_ids.include?(t["id"]) }
        .reject { |t| duplicate_signature?(t) }
        .select { |t| (t["popularity"] || 0) >= MIN_POPULARITY }
        .first(per_genre)

      eligible.each do |track|
        break if tracks.length >= target_count
        tracks << track.merge("source" => "era_hit", "era" => era[:name])
        mark_seen(track, seen_track_ids)
      end
    end

    tracks
  end

  # Pool nostalgic artists from ALL eras, deduped by normalized name (the model
  # stores only names; there is no artist_spotify_id column to key on).
  def unique_nostalgic_artists
    seen = Set.new
    @user.nostalgic_artists.each_with_object([]) do |na, acc|
      key = na.name.to_s.downcase.strip
      next if key.empty? || seen.include?(key)
      seen << key
      acc << na
    end
  end

  def fetch_nostalgic_artist_tracks(target_count, seen_track_ids)
    collected = []

    unique_nostalgic_artists.each do |nostalgic_artist|
      break if collected.length >= target_count

      artist = resolve_nostalgic_artist(nostalgic_artist.name)
      next unless artist

      top_tracks = (@client.artist_top_tracks(artist_id: artist["id"])["tracks"] || [])

      per_artist_remaining = [NOSTALGIC_PER_ARTIST_TARGET, target_count - collected.length].min
      picks = pick_with_popularity_fallback(top_tracks, per_artist_remaining, seen_track_ids)

      picks.each do |track|
        break if collected.length >= target_count
        collected << track.merge(
          "source" => "era_hit",
          "era" => "formative",
          "nostalgic" => true,
          "nostalgic_artist" => nostalgic_artist.name
        )
        mark_seen(track, seen_track_ids)
      end
    end

    collected
  end

  def resolve_nostalgic_artist(name)
    search_results = @client.search(query: name, types: ["artist"], limit: 5)
    search_results.dig("artists", "items", 0)
  end

  # Per-artist popularity fallback: try each tier (60, 30, 0) in order and
  # supplement until we have `limit` tracks or exhaust the supply.
  def pick_with_popularity_fallback(tracks, limit, seen_track_ids)
    collected = []
    used_ids = Set.new

    NOSTALGIC_POPULARITY_TIERS.each do |floor|
      break if collected.length >= limit

      candidates = tracks
        .reject { |t| seen_track_ids.include?(t["id"]) }
        .reject { |t| used_ids.include?(t["id"]) }
        .reject { |t| duplicate_signature?(t) }
        .select { |t| (t["popularity"] || 0) >= floor }

      candidates.each do |track|
        break if collected.length >= limit
        collected << track
        used_ids << track["id"]
      end
    end

    collected
  end

  def safe_search(query, offset: 0)
    result = @client.search(query: query, types: ["track"], limit: 20, offset: offset)
    result.dig("tracks", "items") || []
  rescue SpotifyApiError
    []
  end

  def filter_eligible_tracks(tracks, seen_track_ids, top_50_artist_ids)
    tracks
      .reject { |t| seen_track_ids.include?(t["id"]) }
      .reject { |t| duplicate_signature?(t) }
      .select { |t| (t["popularity"] || 0) >= MIN_POPULARITY }
      .reject { |t| top_50_artist_ids.include?(t.dig("artists", 0, "id")) }
  end

  def track_signature(track)
    name = (track["name"] || "").downcase.gsub(/\s*\(.*?\)\s*/, "").strip
    artist = (track.dig("artists", 0, "name") || "").downcase.strip
    "#{name}|#{artist}"
  end

  def duplicate_signature?(track)
    @seen_signatures&.include?(track_signature(track))
  end

  def mark_seen(track, seen_track_ids)
    seen_track_ids.add(track["id"])
    @seen_signatures&.add(track_signature(track))
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

  def weighted_sample(items, count)
    return items if items.length <= count

    weighted = items.each_with_index.map do |item, index|
      weight = 1.0 / (index + 1)
      random_key = rand ** (1.0 / weight)
      [item, random_key]
    end

    weighted.sort_by { |_, key| -key }.first(count).map(&:first)
  end
end

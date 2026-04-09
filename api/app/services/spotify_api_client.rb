class SpotifyApiClient
  BASE_URL = "https://api.spotify.com/v1"
  MAX_TRACKS_PER_REQUEST = 100

  def initialize(user)
    @user = user
  end

  def current_user
    get("/me")
  end

  def top_artists(time_range: "medium_term", limit: 50)
    get("/me/top/artists", time_range: time_range, limit: limit)
  end

  def top_tracks(time_range: "medium_term", limit: 50)
    get("/me/top/tracks", time_range: time_range, limit: limit)
  end

  def search(query:, types: ["track"], limit: 20)
    get("/search", q: query, type: types.join(","), limit: limit)
  end

  def get_recommendations(seed_genres: [], seed_artists: [], seed_tracks: [], **params)
    query = params.dup
    query[:limit] ||= 20
    query[:seed_genres] = seed_genres.first(5).join(",") if seed_genres.any?
    query[:seed_artists] = seed_artists.first(5).join(",") if seed_artists.any?
    query[:seed_tracks] = seed_tracks.first(5).join(",") if seed_tracks.any?
    get("/recommendations", **query)
  end

  def artist_top_tracks(artist_id:, market: "US")
    get("/artists/#{artist_id}/top-tracks", market: market)
  end

  def related_artists(artist_id:)
    get("/artists/#{artist_id}/related-artists")
  end

  def create_playlist(name:, description: "", public: true)
    user_data = current_user
    post("/users/#{user_data['id']}/playlists", {
      name: name, description: description, public: public
    })
  end

  def add_tracks_to_playlist(playlist_id:, track_uris:)
    track_uris.each_slice(MAX_TRACKS_PER_REQUEST) do |chunk|
      post("/playlists/#{playlist_id}/tracks", { uris: chunk })
    end
  end

  def replace_playlist_tracks(playlist_id:, track_uris:)
    put("/playlists/#{playlist_id}/tracks", { uris: track_uris })
  end

  def get_audio_features(track_ids:)
    get("/audio-features", ids: track_ids.join(","))
  end

  private

  def get(path, **params)
    request(:get, path, params: params)
  end

  def post(path, body)
    request(:post, path, body: body.to_json)
  end

  def put(path, body)
    request(:put, path, body: body.to_json)
  end

  def request(method, path, retried: false, **options)
    ensure_valid_token!

    url = "#{BASE_URL}#{path}"
    response = connection.public_send(method, url) do |req|
      req.headers["Authorization"] = "Bearer #{@user.access_token}"
      req.params = options[:params] if options[:params]
      if options[:body]
        req.headers["Content-Type"] = "application/json"
        req.body = options[:body]
      end
    end

    handle_response(response, method, path, retried, **options)
  end

  def handle_response(response, method, path, retried, **options)
    case response.status
    when 200..299
      response.status == 204 ? nil : JSON.parse(response.body)
    when 401
      raise SpotifyApiError, "Token refresh failed" if retried
      refresh_user_token!
      request(method, path, retried: true, **options)
    when 429
      retry_after = (response.headers["Retry-After"] || "1").to_i
      sleep(retry_after)
      request(method, path, retried: retried, **options)
    else
      body = begin
        JSON.parse(response.body)
      rescue JSON::ParserError
        {}
      end
      message = body.dig("error", "message") || response.reason_phrase
      raise SpotifyApiError, "Spotify API error (#{response.status}): #{message}"
    end
  end

  def ensure_valid_token!
    refresh_user_token! if @user.token_expired?
  end

  def refresh_user_token!
    tokens = SpotifyAuthService.refresh_tokens(refresh_token: @user.refresh_token)
    @user.update!(
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      token_expires_at: tokens[:expires_in].seconds.from_now
    )
  end

  def connection
    @connection ||= Faraday.new
  end
end

class SpotifyApiError < StandardError; end

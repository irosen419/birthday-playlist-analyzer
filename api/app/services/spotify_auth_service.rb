class SpotifyAuthService
  TOKEN_URL = "https://accounts.spotify.com/api/token"
  AUTHORIZE_URL = "https://accounts.spotify.com/authorize"

  SCOPES = %w[
    user-top-read
    user-read-recently-played
    playlist-modify-public
    playlist-modify-private
    playlist-read-private
    user-read-private
    user-read-email
    streaming
    user-read-playback-state
    user-modify-playback-state
  ].freeze

  def self.generate_pkce
    verifier = SecureRandom.urlsafe_base64(32)
    challenge = Base64.urlsafe_encode64(
      Digest::SHA256.digest(verifier), padding: false
    )
    { verifier: verifier, challenge: challenge }
  end

  def self.authorization_url(state:, code_challenge:)
    params = {
      client_id: ENV["SPOTIFY_CLIENT_ID"],
      response_type: "code",
      redirect_uri: ENV["SPOTIFY_REDIRECT_URI"],
      scope: SCOPES.join(" "),
      state: state,
      code_challenge_method: "S256",
      code_challenge: code_challenge
    }
    "#{AUTHORIZE_URL}?#{params.to_query}"
  end

  def self.exchange_code(code:, code_verifier:)
    response = Faraday.post(TOKEN_URL) do |req|
      req.headers["Content-Type"] = "application/x-www-form-urlencoded"
      req.body = URI.encode_www_form(
        client_id: ENV["SPOTIFY_CLIENT_ID"],
        client_secret: ENV["SPOTIFY_CLIENT_SECRET"],
        grant_type: "authorization_code",
        code: code,
        redirect_uri: ENV["SPOTIFY_REDIRECT_URI"],
        code_verifier: code_verifier
      )
    end

    handle_token_response(response)
  end

  def self.refresh_tokens(refresh_token:)
    response = Faraday.post(TOKEN_URL) do |req|
      req.headers["Content-Type"] = "application/x-www-form-urlencoded"
      req.body = URI.encode_www_form(
        client_id: ENV["SPOTIFY_CLIENT_ID"],
        client_secret: ENV["SPOTIFY_CLIENT_SECRET"],
        grant_type: "refresh_token",
        refresh_token: refresh_token
      )
    end

    data = handle_token_response(response)
    data[:refresh_token] ||= refresh_token
    data
  end

  private_class_method def self.handle_token_response(response)
    body = JSON.parse(response.body)

    unless response.success?
      raise SpotifyAuthError, body["error_description"] || body["error"]
    end

    {
      access_token: body["access_token"],
      refresh_token: body["refresh_token"],
      expires_in: body["expires_in"]
    }
  end
end

class SpotifyAuthError < StandardError; end

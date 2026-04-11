# Rack::Attack throttles abusive requests before they reach the Rails stack.
#
# Limits are intentionally conservative to protect the Spotify API quota and
# prevent brute-force attacks on the OAuth callback. Adjust cautiously — these
# values are also exercised by spec/requests/rate_limiting_spec.rb.
class Rack::Attack
  GENERAL_LIMIT  = 100
  GENERATE_LIMIT = 5
  SEARCH_LIMIT   = 30
  AUTH_CALLBACK_LIMIT = 10

  ONE_MINUTE     = 1.minute
  FIVE_MINUTES   = 5.minutes

  GENERATE_PATH_PATTERN = %r{\A/api/playlists/\d+/generate\z}
  SEARCH_PATH           = "/api/search".freeze
  AUTH_CALLBACK_PATH    = "/auth/spotify/callback".freeze

  throttle("req/ip", limit: GENERAL_LIMIT, period: ONE_MINUTE) do |req|
    req.ip
  end

  throttle("generate/ip", limit: GENERATE_LIMIT, period: ONE_MINUTE) do |req|
    req.ip if req.path.match?(GENERATE_PATH_PATTERN)
  end

  throttle("search/ip", limit: SEARCH_LIMIT, period: ONE_MINUTE) do |req|
    req.ip if req.path == SEARCH_PATH
  end

  throttle("auth_callback/ip", limit: AUTH_CALLBACK_LIMIT, period: FIVE_MINUTES) do |req|
    req.ip if req.path == AUTH_CALLBACK_PATH
  end

  self.throttled_responder = lambda do |_request|
    [
      429,
      { "Content-Type" => "application/json" },
      [{ error: "Too many requests. Please try again later." }.to_json]
    ]
  end
end

Rails.application.config.middleware.use Rack::Attack

# Disable in the test environment by default so unrelated specs aren't subject
# to throttling. Individual specs (see spec/requests/rate_limiting_spec.rb)
# can opt in by setting `Rack::Attack.enabled = true`.
Rack::Attack.enabled = false if Rails.env.test?

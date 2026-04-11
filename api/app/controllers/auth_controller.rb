class AuthController < ApplicationController
  def spotify
    state = SecureRandom.hex(16)
    pkce = SpotifyAuthService.generate_pkce

    session[:oauth_state] = state
    session[:pkce_verifier] = pkce[:verifier]

    redirect_to SpotifyAuthService.authorization_url(
      state: state,
      code_challenge: pkce[:challenge]
    ), allow_other_host: true
  end

  def callback
    if params[:error].present?
      redirect_to frontend_url, allow_other_host: true
      return
    end

    unless valid_state?
      render json: { error: "Invalid state parameter" }, status: :unprocessable_entity
      return
    end

    tokens = SpotifyAuthService.exchange_code(
      code: params[:code],
      code_verifier: session[:pkce_verifier]
    )

    temp_user = build_temp_user(tokens)
    profile = SpotifyApiClient.new(temp_user).current_user

    Rails.logger.info "[auth] Spotify profile email: #{profile['email'].inspect}, allowlist: #{parsed_allowlist.inspect}"

    unless email_allowed?(profile["email"])
      Rails.logger.warn "[auth] Email not in allowlist: #{profile['email'].inspect}"
      reset_session
      redirect_to "#{frontend_url}?error=unauthorized", allow_other_host: true
      return
    end

    user = upsert_user(profile, tokens)
    token = AuthTokenService.encode(user.id)
    reset_session

    redirect_to "#{frontend_url}#auth_token=#{token}", allow_other_host: true
  end

  private

  def valid_state?
    params[:state].present? && params[:state] == session[:oauth_state]
  end

  # Returns true when no allowlist is configured (open sign-up for dev) or
  # when the given email appears in the comma-separated ALLOWED_EMAILS env var.
  # Matching is case-insensitive and tolerant of surrounding whitespace so
  # operators can paste lists casually into the Render dashboard.
  def email_allowed?(email)
    allowlist = parsed_allowlist
    return true if allowlist.empty?
    return false if email.blank?

    allowlist.include?(email.to_s.strip.downcase)
  end

  def parsed_allowlist
    raw = ENV["ALLOWED_EMAILS"]
    return [] if raw.nil? || raw.strip.empty?

    raw.split(",").map { |entry| entry.strip.downcase }.reject(&:empty?)
  end

  def build_temp_user(tokens)
    User.new(
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      token_expires_at: tokens[:expires_in].seconds.from_now
    )
  end

  def upsert_user(profile, tokens)
    user = User.find_or_initialize_by(spotify_id: profile["id"])
    user.update!(
      display_name: profile["display_name"],
      email: profile["email"],
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      token_expires_at: tokens[:expires_in].seconds.from_now
    )
    user
  end

  def frontend_url
    ENV["FRONTEND_URL"] || "http://localhost:5173"
  end
end

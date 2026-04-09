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

    user = upsert_user(profile, tokens)
    session[:user_id] = user.id

    redirect_to frontend_url, allow_other_host: true
  end

  def logout
    reset_session
    render json: { message: "Logged out" }
  end

  private

  def valid_state?
    params[:state].present? && params[:state] == session[:oauth_state]
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

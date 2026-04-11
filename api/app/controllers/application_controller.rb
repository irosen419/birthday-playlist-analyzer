class ApplicationController < ActionController::API
  include ActionController::Cookies

  private

  def current_user
    return @current_user if defined?(@current_user)

    token = bearer_token
    @current_user = token ? User.find_by(id: AuthTokenService.decode(token)) : nil
  end

  def bearer_token
    header = request.headers["Authorization"]
    return nil unless header&.start_with?("Bearer ")

    header.split(" ", 2).last
  end

  def authenticate_user!
    render json: { error: "Unauthorized" }, status: :unauthorized unless current_user
  end

  def spotify_client
    @spotify_client ||= SpotifyApiClient.new(current_user)
  end
end

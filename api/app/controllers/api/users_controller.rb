module Api
  class UsersController < ApplicationController
    before_action :authenticate_user!

    USER_FIELDS = %i[id spotify_id display_name email birth_year setup_completed].freeze

    def me
      render json: current_user.as_json(only: USER_FIELDS)
    end

    def update
      if current_user.update(user_params)
        render json: current_user.as_json(only: USER_FIELDS)
      else
        render json: { errors: current_user.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def token
      render json: { access_token: current_user.access_token }
    end

    private

    def user_params
      params.permit(:birth_year, :display_name, :setup_completed)
    end
  end
end

module Api
  class NostalgicArtistsController < ApplicationController
    before_action :authenticate_user!

    def index
      render json: current_user.nostalgic_artists
    end

    def create
      artist = current_user.nostalgic_artists.build(artist_params)

      if artist.save
        render json: artist, status: :created
      else
        render json: { errors: artist.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def destroy
      artist = current_user.nostalgic_artists.find_by(id: params[:id])

      if artist
        artist.destroy!
        head :no_content
      else
        render json: { error: "Not found" }, status: :not_found
      end
    end

    private

    def artist_params
      if params[:nostalgic_artist].present?
        params.require(:nostalgic_artist).permit(:name, :era, :spotify_artist_id)
      else
        params.permit(:name, :era, :spotify_artist_id)
      end
    end
  end
end

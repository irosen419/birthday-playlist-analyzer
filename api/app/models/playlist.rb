class Playlist < ApplicationRecord
  belongs_to :user
  has_many :playlist_tracks, -> { order(:position) }, dependent: :destroy
  has_many :tracks, through: :playlist_tracks

  validates :name, presence: true

  def effective_birth_year
    birth_year || user.birth_year
  end

  def published?
    spotify_playlist_id.present?
  end
end

class User < ApplicationRecord
  has_many :playlists, dependent: :destroy
  has_many :nostalgic_artists, dependent: :destroy

  has_encrypted :access_token, :refresh_token

  validates :spotify_id, presence: true, uniqueness: true

  after_create :seed_default_nostalgic_artists

  def token_expired?
    token_expires_at < Time.current
  end

  private

  DEFAULT_NOSTALGIC_ARTISTS = [
    'NSYNC',
    'Backstreet Boys',
    'Smash Mouth',
    'Britney Spears',
    'Christina Aguilera'
  ].freeze

  def seed_default_nostalgic_artists
    DEFAULT_NOSTALGIC_ARTISTS.each do |artist_name|
      nostalgic_artists.find_or_create_by!(name: artist_name, era: 'formative')
    end
  end
end

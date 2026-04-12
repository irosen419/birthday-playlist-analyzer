class User < ApplicationRecord
  has_many :playlists, dependent: :destroy
  has_many :nostalgic_artists, dependent: :destroy

  has_encrypted :access_token, :refresh_token

  validates :spotify_id, presence: true, uniqueness: true

  def token_expired?
    token_expires_at < Time.current
  end
end

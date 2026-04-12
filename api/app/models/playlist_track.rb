class PlaylistTrack < ApplicationRecord
  belongs_to :playlist
  belongs_to :track

  enum :source, { favorite: 0, genre_discovery: 1, era_hit: 2, manual: 3, reconciliation: 4 }

  validates :position, presence: true, uniqueness: { scope: :playlist_id }
end

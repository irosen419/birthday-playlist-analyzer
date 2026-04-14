class NostalgicArtist < ApplicationRecord
  belongs_to :user

  validates :name, presence: true
  validates :era, presence: true, inclusion: { in: %w[formative high_school college] }
  validates :spotify_artist_id, presence: true
  validates :name, uniqueness: { scope: %i[user_id era] }
end

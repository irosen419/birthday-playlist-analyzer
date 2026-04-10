class Playlist < ApplicationRecord
  RATIO_SUM_TOLERANCE = 0.02
  VALID_SONG_COUNT_RANGE = (50..200).freeze

  belongs_to :user
  has_many :playlist_tracks, -> { order(:position) }, dependent: :destroy
  has_many :tracks, through: :playlist_tracks

  validates :name, presence: true
  validates :target_song_count, inclusion: { in: VALID_SONG_COUNT_RANGE }, allow_nil: true

  def effective_birth_year
    birth_year || user.birth_year
  end

  def published?
    spotify_playlist_id.present?
  end

  def generation_config
    {
      favorites_ratio: favorites_ratio,
      discovery_ratio: discovery_ratio,
      era_hits_ratio: era_hits_ratio,
      target_song_count: target_song_count
    }
  end

  private

  def ratios_must_sum_to_one
    total = (favorites_ratio || 0.3) + (discovery_ratio || 0.3) + (era_hits_ratio || 0.4)
    return if (total - 1.0).abs <= RATIO_SUM_TOLERANCE

    errors.add(:base, "Generation ratios must sum to 100% (currently #{(total * 100).round(1)}%)")
  end
end

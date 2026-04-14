class Track < ApplicationRecord
  has_many :playlist_tracks, dependent: :destroy

  validates :spotify_id, presence: true, uniqueness: true
  validates :name, presence: true

  def self.upsert_from_spotify(data)
    track = find_or_initialize_by(spotify_id: data[:id])

    track.update!(
      name: data[:name],
      artist_names: extract_artist_names(data[:artists]),
      album_name: data.dig(:album, :name),
      album_art_url: extract_album_art_url(data[:album]),
      duration_ms: data[:duration_ms],
      popularity: data[:popularity],
      preview_url: data[:preview_url],
      uri: data[:uri]
    )

    track
  end

  class << self
    private

    def extract_artist_names(artists)
      return [] if artists.blank?

      artists.map { |a| { "id" => a[:id] || a["id"], "name" => a[:name] || a["name"] } }
    end

    def extract_album_art_url(album)
      return nil if album.blank?

      album.dig(:images, 0, :url)
    end
  end
end

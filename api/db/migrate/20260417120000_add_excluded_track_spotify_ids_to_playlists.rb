class AddExcludedTrackSpotifyIdsToPlaylists < ActiveRecord::Migration[8.0]
  def change
    add_column :playlists, :excluded_track_spotify_ids, :jsonb, default: [], null: false
  end
end

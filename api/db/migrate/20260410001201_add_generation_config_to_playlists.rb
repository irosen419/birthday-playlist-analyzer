class AddGenerationConfigToPlaylists < ActiveRecord::Migration[8.0]
  def change
    add_column :playlists, :favorites_ratio, :float, default: 0.3
    add_column :playlists, :discovery_ratio, :float, default: 0.3
    add_column :playlists, :era_hits_ratio, :float, default: 0.4
    add_column :playlists, :target_song_count, :integer, default: 125
  end
end

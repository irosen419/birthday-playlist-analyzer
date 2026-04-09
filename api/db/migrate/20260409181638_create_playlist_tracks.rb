class CreatePlaylistTracks < ActiveRecord::Migration[8.0]
  def change
    create_table :playlist_tracks do |t|
      t.references :playlist, null: false, foreign_key: true
      t.references :track, null: false, foreign_key: true
      t.integer :position, null: false
      t.boolean :locked, default: false
      t.integer :source, default: 0
      t.timestamps
    end

    add_index :playlist_tracks, %i[playlist_id position], unique: true
    add_index :playlist_tracks, %i[playlist_id track_id], unique: true
  end
end

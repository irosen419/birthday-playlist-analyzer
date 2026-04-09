class CreateTracks < ActiveRecord::Migration[8.0]
  def change
    create_table :tracks do |t|
      t.string :spotify_id, null: false
      t.string :name, null: false
      t.jsonb :artist_names, default: []
      t.string :album_name
      t.string :album_art_url
      t.integer :duration_ms
      t.integer :popularity
      t.string :preview_url
      t.string :uri
      t.timestamps
    end

    add_index :tracks, :spotify_id, unique: true
  end
end

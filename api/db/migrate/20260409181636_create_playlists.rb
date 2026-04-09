class CreatePlaylists < ActiveRecord::Migration[8.0]
  def change
    create_table :playlists do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.boolean :is_public, default: true
      t.string :spotify_playlist_id
      t.datetime :published_at
      t.integer :birth_year
      t.timestamps
    end
  end
end

class FinalizeNostalgicArtistSpotifyId < ActiveRecord::Migration[8.0]
  def up
    remove_index :nostalgic_artists, name: "index_nostalgic_artists_on_user_id_and_name_and_era"
    remove_index :nostalgic_artists, name: "idx_nostalgic_artists_on_user_spotify_id_era"

    change_column_null :nostalgic_artists, :spotify_artist_id, false

    add_index :nostalgic_artists,
              [:user_id, :spotify_artist_id, :era],
              unique: true,
              name: "idx_nostalgic_artists_on_user_spotify_id_era"
  end

  def down
    remove_index :nostalgic_artists, name: "idx_nostalgic_artists_on_user_spotify_id_era"

    change_column_null :nostalgic_artists, :spotify_artist_id, true

    add_index :nostalgic_artists,
              [:user_id, :spotify_artist_id, :era],
              unique: true,
              where: "spotify_artist_id IS NOT NULL",
              name: "idx_nostalgic_artists_on_user_spotify_id_era"

    add_index :nostalgic_artists,
              [:user_id, :name, :era],
              unique: true,
              name: "index_nostalgic_artists_on_user_id_and_name_and_era"
  end
end

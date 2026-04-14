class AddSpotifyArtistIdToNostalgicArtists < ActiveRecord::Migration[8.0]
  def change
    add_column :nostalgic_artists, :spotify_artist_id, :string

    add_index :nostalgic_artists,
              [:user_id, :spotify_artist_id, :era],
              unique: true,
              where: "spotify_artist_id IS NOT NULL",
              name: "idx_nostalgic_artists_on_user_spotify_id_era"
  end
end

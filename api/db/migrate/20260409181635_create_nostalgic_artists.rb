class CreateNostalgicArtists < ActiveRecord::Migration[8.0]
  def change
    create_table :nostalgic_artists do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.string :era, null: false
      t.timestamps
    end

    add_index :nostalgic_artists, %i[user_id name era], unique: true
  end
end

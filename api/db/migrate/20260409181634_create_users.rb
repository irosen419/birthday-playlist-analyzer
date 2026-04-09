class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string :spotify_id, null: false
      t.string :display_name
      t.string :email
      t.integer :birth_year, default: 1991
      t.text :access_token_ciphertext
      t.text :refresh_token_ciphertext
      t.datetime :token_expires_at
      t.timestamps
    end

    add_index :users, :spotify_id, unique: true
  end
end

# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_04_09_181638) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "nostalgic_artists", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name", null: false
    t.string "era", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "name", "era"], name: "index_nostalgic_artists_on_user_id_and_name_and_era", unique: true
    t.index ["user_id"], name: "index_nostalgic_artists_on_user_id"
  end

  create_table "playlist_tracks", force: :cascade do |t|
    t.bigint "playlist_id", null: false
    t.bigint "track_id", null: false
    t.integer "position", null: false
    t.boolean "locked", default: false
    t.integer "source", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["playlist_id", "position"], name: "index_playlist_tracks_on_playlist_id_and_position", unique: true
    t.index ["playlist_id", "track_id"], name: "index_playlist_tracks_on_playlist_id_and_track_id", unique: true
    t.index ["playlist_id"], name: "index_playlist_tracks_on_playlist_id"
    t.index ["track_id"], name: "index_playlist_tracks_on_track_id"
  end

  create_table "playlists", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "is_public", default: true
    t.string "spotify_playlist_id"
    t.datetime "published_at"
    t.integer "birth_year"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_playlists_on_user_id"
  end

  create_table "tracks", force: :cascade do |t|
    t.string "spotify_id", null: false
    t.string "name", null: false
    t.jsonb "artist_names", default: []
    t.string "album_name"
    t.string "album_art_url"
    t.integer "duration_ms"
    t.integer "popularity"
    t.string "preview_url"
    t.string "uri"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["spotify_id"], name: "index_tracks_on_spotify_id", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "spotify_id", null: false
    t.string "display_name"
    t.string "email"
    t.integer "birth_year", default: 1991
    t.text "access_token_ciphertext"
    t.text "refresh_token_ciphertext"
    t.datetime "token_expires_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["spotify_id"], name: "index_users_on_spotify_id", unique: true
  end

  add_foreign_key "nostalgic_artists", "users"
  add_foreign_key "playlist_tracks", "playlists"
  add_foreign_key "playlist_tracks", "tracks"
  add_foreign_key "playlists", "users"
end

FactoryBot.define do
  factory :track do
    spotify_id { SecureRandom.hex(11) }
    name { Faker::Music::RockBand.song }
    artist_names { [Faker::Music.band] }
    album_name { Faker::Music.album }
    album_art_url { Faker::Internet.url }
    duration_ms { rand(180_000..300_000) }
    popularity { rand(40..100) }
    preview_url { Faker::Internet.url }
    uri { "spotify:track:#{SecureRandom.hex(11)}" }
  end
end

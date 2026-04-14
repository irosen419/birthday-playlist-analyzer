FactoryBot.define do
  factory :nostalgic_artist do
    user
    name { Faker::Music.band }
    era { 'formative' }
    sequence(:spotify_artist_id) { |n| "spotify_artist_#{n}" }
  end
end

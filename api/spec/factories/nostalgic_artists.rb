FactoryBot.define do
  factory :nostalgic_artist do
    user
    name { Faker::Music.band }
    era { 'formative' }
  end
end

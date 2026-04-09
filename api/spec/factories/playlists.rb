FactoryBot.define do
  factory :playlist do
    user
    name { "Birthday Playlist #{Faker::Number.unique.number(digits: 4)}" }
    description { Faker::Lorem.sentence }
    is_public { true }
  end
end

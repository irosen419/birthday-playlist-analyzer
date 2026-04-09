FactoryBot.define do
  factory :user do
    spotify_id { SecureRandom.hex(12) }
    display_name { Faker::Internet.username }
    email { Faker::Internet.email }
    birth_year { 1991 }
    access_token { SecureRandom.hex(32) }
    refresh_token { SecureRandom.hex(32) }
    token_expires_at { 1.hour.from_now }
  end
end

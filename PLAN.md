# Birthday Playlist Analyzer - Full Rewrite Plan

## Rails 8 API + React TypeScript Monorepo

This document is a self-contained implementation plan for rewriting the Birthday Playlist Analyzer from Node.js/Express/vanilla JS to a Rails 8 API backend + React TypeScript frontend. A developer (or AI) with zero prior context should be able to build the entire application from this plan alone.

All development MUST follow **Test-Driven Development (RED, GREEN, REFACTOR)**.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Existing Code Reference Map](#2-existing-code-reference-map)
3. [Database Schema](#3-database-schema)
4. [Phase 1: Project Scaffolding](#phase-1-project-scaffolding)
5. [Phase 2: Database + Models (TDD)](#phase-2-database--models-tdd)
6. [Phase 3: Spotify Services (TDD)](#phase-3-spotify-services-tdd)
7. [Phase 4: Auth Flow (TDD)](#phase-4-auth-flow-tdd)
8. [Phase 5: API Endpoints (TDD)](#phase-5-api-endpoints-tdd)
9. [Phase 6: React Core UI](#phase-6-react-core-ui)
10. [Phase 7: Playlist Editor](#phase-7-playlist-editor)
11. [Phase 8: Track Locking](#phase-8-track-locking)
12. [Phase 9: Nostalgic Artists + Config](#phase-9-nostalgic-artists--config)
13. [Phase 10: Player + Analysis](#phase-10-player--analysis)
14. [Phase 11: Polish](#phase-11-polish)

---

## 1. Architecture Overview

```
birthday-playlist-analyzer/
  src/                    # Existing Node.js app (DO NOT delete during development)
  api/                    # NEW: Rails 8 API-only backend
  client/                 # NEW: React + TypeScript + Vite frontend
  PLAN.md                 # This file
```

### Stack

| Layer      | Technology                            | Port  |
|------------|---------------------------------------|-------|
| Backend    | Rails 8.0.4 (API-only), Ruby 3.3.5   | 3000  |
| Frontend   | React 18, TypeScript, Vite, Tailwind  | 5173  |
| Database   | PostgreSQL 16.10                      | 5432  |
| Testing    | RSpec (Rails), Vitest (React)         | -     |

### Key Design Decisions

- **Monorepo** with `/api` and `/client` directories
- **Auth**: Spotify OAuth handled entirely server-side by Rails; cookie-based sessions; frontend uses `credentials: 'include'` on all requests
- **CORS**: Rails allows `http://localhost:5173` with credentials
- **LAN access**: Both servers bind to `0.0.0.0`
- **Token storage**: Spotify access/refresh tokens encrypted at rest via lockbox gem
- **Auto-save**: Every playlist mutation triggers a debounced (500ms) PATCH from the frontend

---

## 2. Existing Code Reference Map

Port logic from these files. Do NOT delete them during development.

| Existing File                                  | New Rails/React Equivalent                      |
|------------------------------------------------|-------------------------------------------------|
| `src/playlist/birthday-playlist-generator.js`  | `app/services/playlist_generator_service.rb`    |
| `src/playlist/era-calculator.js`               | `app/services/era_calculator.rb`                |
| `src/api/spotify-client.js`                    | `app/services/spotify_api_client.rb`            |
| `src/auth/oauth.js`                            | `app/services/spotify_auth_service.rb`          |
| `src/analysis/top-items-analyzer.js`           | `app/services/top_items_analyzer.rb`            |
| `src/public/js/app.js`                         | React components + hooks                        |
| `src/public/js/player.js`                      | `client/src/hooks/useSpotifyPlayer.ts`          |
| `src/public/js/api.js`                         | `client/src/api/client.ts`                      |
| `src/public/css/styles.css`                    | Tailwind classes (reference for design tokens)  |
| `src/config.js`                                | Rails env vars + `config/application.rb`        |
| `src/server/api-routes.js`                     | Rails controllers                               |
| `src/auth/server.js`                           | `AuthController`                                |
| `src/playlist/playlist-generator.test.js`      | `spec/services/era_calculator_spec.rb`          |

### Key Constants from Existing Code

```
TARGET_SONG_COUNT = 125
FAVORITES_RATIO = 0.3        (37 tracks)
GENRE_DISCOVERY_RATIO = 0.3  (37 tracks)
ERA_HITS_RATIO = 0.4         (51 tracks)
MIN_POPULARITY = 60
MAX_PER_ARTIST = 3           (in favorites selection)
DEFAULT_BIRTH_YEAR = 1991
TIME_RANGES = ['short_term', 'medium_term', 'long_term']
```

### Spotify Configuration

```
Scopes: user-top-read, user-read-recently-played, playlist-modify-public,
        playlist-modify-private, playlist-read-private, user-read-private,
        streaming, user-read-playback-state, user-modify-playback-state
Auth URL: https://accounts.spotify.com/authorize
Token URL: https://accounts.spotify.com/api/token
API Base: https://api.spotify.com/v1
Redirect URI: http://localhost:3000/auth/spotify/callback
```

---

## 3. Database Schema

### ERD Summary

```
users 1--* nostalgic_artists
users 1--* playlists
playlists 1--* playlist_tracks
tracks 1--* playlist_tracks
```

### Migration Details

#### users

```ruby
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
```

#### nostalgic_artists

```ruby
create_table :nostalgic_artists do |t|
  t.references :user, null: false, foreign_key: true
  t.string :name, null: false
  t.string :era, null: false  # formative, high_school, college
  t.timestamps
end

add_index :nostalgic_artists, [:user_id, :name, :era], unique: true
```

#### playlists

```ruby
create_table :playlists do |t|
  t.references :user, null: false, foreign_key: true
  t.string :name, null: false
  t.text :description
  t.boolean :is_public, default: true
  t.string :spotify_playlist_id       # set when published to Spotify
  t.datetime :published_at            # set when published to Spotify
  t.integer :birth_year               # overrides user.birth_year when set
  t.timestamps
end
```

#### tracks

```ruby
create_table :tracks do |t|
  t.string :spotify_id, null: false
  t.string :name, null: false
  t.jsonb :artist_names, default: []
  t.string :album_name
  t.string :album_art_url
  t.integer :duration_ms
  t.integer :popularity
  t.string :preview_url
  t.string :uri
  t.timestamps
end

add_index :tracks, :spotify_id, unique: true
```

#### playlist_tracks

```ruby
create_table :playlist_tracks do |t|
  t.references :playlist, null: false, foreign_key: true
  t.references :track, null: false, foreign_key: true
  t.integer :position, null: false
  t.boolean :locked, default: false
  t.integer :source, default: 0  # enum: favorite=0, genre_discovery=1, era_hit=2, manual=3
  t.timestamps
end

add_index :playlist_tracks, [:playlist_id, :position], unique: true
add_index :playlist_tracks, [:playlist_id, :track_id], unique: true
```

---

## Phase 1: Project Scaffolding

### 1A. Rails API Setup

```bash
cd /Users/irosen419/code/birthday-playlist-analyzer
rails new api --api --database=postgresql --skip-test
cd api
```

#### Gemfile additions

```ruby
# Gemfile (add to existing)
gem "rack-cors"
gem "lockbox"
gem "blind_index"
gem "dotenv-rails", groups: [:development, :test]
gem "faraday"

group :development, :test do
  gem "rspec-rails"
  gem "factory_bot_rails"
  gem "faker"
end

group :test do
  gem "webmock"
  gem "shoulda-matchers"
end
```

Then run:

```bash
bundle install
rails generate rspec:install
```

#### Configure CORS (`config/initializers/cors.rb`)

```ruby
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("FRONTEND_URL", "http://localhost:5173")
    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      credentials: true
  end
end
```

#### Configure Sessions (`config/application.rb`)

Rails API-only mode does not include session middleware by default. Add:

```ruby
# In config/application.rb, inside the Application class:
config.middleware.use ActionDispatch::Cookies
config.middleware.use ActionDispatch::Session::CookieStore,
  key: "_birthday_playlist_session",
  same_site: :lax,
  secure: Rails.env.production?

# Also add to ApplicationController:
# include ActionController::Cookies
```

#### Configure Lockbox (`config/initializers/lockbox.rb`)

```ruby
Lockbox.master_key = ENV["LOCKBOX_MASTER_KEY"]
```

#### Configure Database (`config/database.yml`)

Standard PostgreSQL configuration. Database names:

- `birthday_playlist_dev`
- `birthday_playlist_test`

#### Environment Variables (`api/.env`)

```
SPOTIFY_CLIENT_ID=<your_client_id>
SPOTIFY_CLIENT_SECRET=<your_client_secret>
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/spotify/callback
LOCKBOX_MASTER_KEY=<generate with Lockbox.generate_key>
FRONTEND_URL=http://localhost:5173
SECRET_KEY_BASE=<rails secret>
```

Add `api/.env` to `.gitignore`.

#### Configure RSpec (`spec/rails_helper.rb`)

Add to the RSpec configure block:

```ruby
config.include FactoryBot::Syntax::Methods

# shoulda-matchers
Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end
```

Add to `spec/support/webmock.rb`:

```ruby
require "webmock/rspec"
WebMock.disable_net_connect!(allow_localhost: true)
```

Ensure `spec/support` files are loaded by uncommenting in `rails_helper.rb`:

```ruby
Dir[Rails.root.join("spec/support/**/*.rb")].each { |f| require f }
```

### 1B. React + TypeScript + Vite Setup

```bash
cd /Users/irosen419/code/birthday-playlist-analyzer
npm create vite@latest client -- --template react-ts
cd client
npm install
```

#### Dependencies

```bash
npm install react-router-dom @tanstack/react-query axios @hello-pangea/dnd
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom
```

#### Configure Vite (`client/vite.config.ts`)

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

#### Configure Tailwind (`client/src/index.css`)

```css
@import "tailwindcss";
```

#### Axios Instance (`client/src/api/client.ts`)

```typescript
import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
```

#### Environment Variables (`client/.env`)

```
VITE_API_URL=http://localhost:3000
```

### 1C. Verification Checklist

- [ ] `cd api && rails db:create` succeeds
- [ ] `cd api && bundle exec rspec` runs (0 examples)
- [ ] `cd client && npm run dev` starts on port 5173
- [ ] `cd client && npx vitest run` runs (0 tests)

---

## Phase 2: Database + Models (TDD)

### TDD Approach

Write model specs first, then create migrations and model code to make them pass.

### 2A. User Model

#### RED: Write spec first (`spec/models/user_spec.rb`)

```ruby
require "rails_helper"

RSpec.describe User, type: :model do
  describe "validations" do
    subject { build(:user) }

    it { should validate_presence_of(:spotify_id) }
    it { should validate_uniqueness_of(:spotify_id) }
    it { should validate_numericality_of(:birth_year).only_integer.allow_nil }
  end

  describe "associations" do
    it { should have_many(:nostalgic_artists).dependent(:destroy) }
    it { should have_many(:playlists).dependent(:destroy) }
  end

  describe "encryption" do
    it "encrypts access_token" do
      user = create(:user, access_token: "test_token")
      expect(user.access_token_ciphertext).not_to eq("test_token")
      expect(user.access_token).to eq("test_token")
    end

    it "encrypts refresh_token" do
      user = create(:user, refresh_token: "test_refresh")
      expect(user.refresh_token_ciphertext).not_to eq("test_refresh")
      expect(user.refresh_token).to eq("test_refresh")
    end
  end

  describe "#token_expired?" do
    it "returns true when token_expires_at is in the past" do
      user = build(:user, token_expires_at: 1.minute.ago)
      expect(user.token_expired?).to be true
    end

    it "returns false when token_expires_at is in the future" do
      user = build(:user, token_expires_at: 1.hour.from_now)
      expect(user.token_expired?).to be false
    end

    it "returns true when token_expires_at is nil" do
      user = build(:user, token_expires_at: nil)
      expect(user.token_expired?).to be true
    end
  end

  describe "#effective_birth_year" do
    it "returns the user's birth_year" do
      user = build(:user, birth_year: 1991)
      expect(user.effective_birth_year).to eq(1991)
    end

    it "returns default 1991 when birth_year is nil" do
      user = build(:user, birth_year: nil)
      expect(user.effective_birth_year).to eq(1991)
    end
  end
end
```

#### Factory (`spec/factories/users.rb`)

```ruby
FactoryBot.define do
  factory :user do
    spotify_id { Faker::Alphanumeric.alphanumeric(number: 22) }
    display_name { Faker::Name.name }
    email { Faker::Internet.email }
    birth_year { 1991 }
    access_token { Faker::Alphanumeric.alphanumeric(number: 100) }
    refresh_token { Faker::Alphanumeric.alphanumeric(number: 100) }
    token_expires_at { 1.hour.from_now }
  end
end
```

#### GREEN: Implement

1. Generate migration for `users` table (see schema above)
2. Implement `User` model:

```ruby
class User < ApplicationRecord
  has_encrypted :access_token
  has_encrypted :refresh_token

  has_many :nostalgic_artists, dependent: :destroy
  has_many :playlists, dependent: :destroy

  validates :spotify_id, presence: true, uniqueness: true
  validates :birth_year, numericality: { only_integer: true }, allow_nil: true

  DEFAULT_BIRTH_YEAR = 1991

  def token_expired?
    token_expires_at.nil? || token_expires_at < Time.current
  end

  def effective_birth_year
    birth_year || DEFAULT_BIRTH_YEAR
  end
end
```

#### Seed default nostalgic artists on user creation

Use an `after_create` callback:

```ruby
after_create :seed_default_nostalgic_artists

private

def seed_default_nostalgic_artists
  default_artists = %w[NSYNC].push("Backstreet Boys", "Smash Mouth", "Britney Spears", "Christina Aguilera")
  default_artists.each do |artist_name|
    nostalgic_artists.create!(name: artist_name, era: "formative")
  end
end
```

### 2B. NostalgicArtist Model

#### RED: Spec (`spec/models/nostalgic_artist_spec.rb`)

```ruby
require "rails_helper"

RSpec.describe NostalgicArtist, type: :model do
  describe "validations" do
    subject { build(:nostalgic_artist) }

    it { should validate_presence_of(:name) }
    it { should validate_presence_of(:era) }
    it { should validate_inclusion_of(:era).in_array(%w[formative high_school college]) }
    it { should validate_uniqueness_of(:name).scoped_to(:user_id, :era) }
  end

  describe "associations" do
    it { should belong_to(:user) }
  end
end
```

#### GREEN: Implement

```ruby
class NostalgicArtist < ApplicationRecord
  belongs_to :user

  VALID_ERAS = %w[formative high_school college].freeze

  validates :name, presence: true
  validates :era, presence: true, inclusion: { in: VALID_ERAS }
  validates :name, uniqueness: { scope: [:user_id, :era] }
end
```

### 2C. Playlist Model

#### RED: Spec (`spec/models/playlist_spec.rb`)

```ruby
require "rails_helper"

RSpec.describe Playlist, type: :model do
  describe "validations" do
    it { should validate_presence_of(:name) }
  end

  describe "associations" do
    it { should belong_to(:user) }
    it { should have_many(:playlist_tracks).dependent(:destroy).order(:position) }
    it { should have_many(:tracks).through(:playlist_tracks) }
  end

  describe "#published?" do
    it "returns true when spotify_playlist_id is present" do
      playlist = build(:playlist, spotify_playlist_id: "abc123")
      expect(playlist.published?).to be true
    end

    it "returns false when spotify_playlist_id is nil" do
      playlist = build(:playlist, spotify_playlist_id: nil)
      expect(playlist.published?).to be false
    end
  end

  describe "#effective_birth_year" do
    it "returns playlist birth_year when set" do
      user = build(:user, birth_year: 1991)
      playlist = build(:playlist, user: user, birth_year: 1985)
      expect(playlist.effective_birth_year).to eq(1985)
    end

    it "falls back to user birth_year when playlist birth_year is nil" do
      user = build(:user, birth_year: 1991)
      playlist = build(:playlist, user: user, birth_year: nil)
      expect(playlist.effective_birth_year).to eq(1991)
    end
  end

  describe "#track_count" do
    it "returns the number of playlist_tracks" do
      playlist = create(:playlist)
      create_list(:playlist_track, 3, playlist: playlist)
      expect(playlist.track_count).to eq(3)
    end
  end
end
```

#### GREEN: Implement

```ruby
class Playlist < ApplicationRecord
  belongs_to :user
  has_many :playlist_tracks, -> { order(:position) }, dependent: :destroy
  has_many :tracks, through: :playlist_tracks

  validates :name, presence: true

  def published?
    spotify_playlist_id.present?
  end

  def effective_birth_year
    birth_year || user.effective_birth_year
  end

  def track_count
    playlist_tracks.count
  end
end
```

### 2D. Track Model

#### RED: Spec (`spec/models/track_spec.rb`)

```ruby
require "rails_helper"

RSpec.describe Track, type: :model do
  describe "validations" do
    subject { build(:track) }

    it { should validate_presence_of(:spotify_id) }
    it { should validate_uniqueness_of(:spotify_id) }
    it { should validate_presence_of(:name) }
  end

  describe "associations" do
    it { should have_many(:playlist_tracks).dependent(:destroy) }
    it { should have_many(:playlists).through(:playlist_tracks) }
  end
end
```

#### GREEN: Implement

```ruby
class Track < ApplicationRecord
  has_many :playlist_tracks, dependent: :destroy
  has_many :playlists, through: :playlist_tracks

  validates :spotify_id, presence: true, uniqueness: true
  validates :name, presence: true
end
```

### 2E. PlaylistTrack Model

#### RED: Spec (`spec/models/playlist_track_spec.rb`)

```ruby
require "rails_helper"

RSpec.describe PlaylistTrack, type: :model do
  describe "validations" do
    subject { build(:playlist_track) }

    it { should validate_presence_of(:position) }
    it { should validate_uniqueness_of(:position).scoped_to(:playlist_id) }
    it { should validate_uniqueness_of(:track_id).scoped_to(:playlist_id) }
  end

  describe "associations" do
    it { should belong_to(:playlist) }
    it { should belong_to(:track) }
  end

  describe "enums" do
    it { should define_enum_for(:source).with_values(favorite: 0, genre_discovery: 1, era_hit: 2, manual: 3) }
  end
end
```

#### GREEN: Implement

```ruby
class PlaylistTrack < ApplicationRecord
  belongs_to :playlist
  belongs_to :track

  enum :source, { favorite: 0, genre_discovery: 1, era_hit: 2, manual: 3 }

  validates :position, presence: true, uniqueness: { scope: :playlist_id }
  validates :track_id, uniqueness: { scope: :playlist_id }
end
```

### REFACTOR

After all models pass, review for:
- Consistent naming
- Missing scopes (e.g., `Playlist.published`, `PlaylistTrack.locked`)
- Any DRY violations

---

## Phase 3: Spotify Services (TDD)

### 3A. EraCalculator

Port from `src/playlist/era-calculator.js`. This is a pure-logic service with no external dependencies -- ideal for TDD.

#### RED: Spec (`spec/services/era_calculator_spec.rb`)

```ruby
require "rails_helper"

RSpec.describe EraCalculator do
  describe ".calculate_era_ranges" do
    it "calculates correct ranges for birth year 1991" do
      ranges = described_class.calculate_era_ranges(1991)

      expect(ranges).to include(
        { name: "formative", year_range: "2001-2003", age_range: "10-12", years: [2001, 2003] },
        { name: "high_school", year_range: "2005-2009", age_range: "14-18", years: [2005, 2009] },
        { name: "college", year_range: "2009-2013", age_range: "18-22", years: [2009, 2013] },
        { name: "recent", year_range: "2023-2025", age_range: "recent", years: [2023, 2025] },
        { name: "current", year_range: "2026", age_range: "current", years: [2026, 2026] }
      )
    end

    it "calculates correct ranges for birth year 1985" do
      ranges = described_class.calculate_era_ranges(1985)

      expect(ranges[0][:year_range]).to eq("1995-1997")
      expect(ranges[1][:year_range]).to eq("1999-2003")
      expect(ranges[2][:year_range]).to eq("2003-2007")
    end
  end

  describe ".distribute_era_track_count" do
    it "distributes 51 tracks with formative priority" do
      distribution = described_class.distribute_era_track_count(51)

      expect(distribution[:formative]).to be >= 15
      expect(distribution[:current]).to be >= 3
      total = distribution.values.sum
      expect(total).to eq(51)
    end

    it "distributes 36 tracks correctly" do
      distribution = described_class.distribute_era_track_count(36)

      expect(distribution[:formative]).to be >= 10
      expect(distribution[:high_school]).to be >= 6
      expect(distribution[:college]).to be >= 6
      expect(distribution[:recent]).to be >= 6
      expect(distribution[:current]).to be >= 3

      total = distribution.values.sum
      expect(total).to eq(36)
    end

    it "handles smaller track counts" do
      distribution = described_class.distribute_era_track_count(15)

      total = distribution.values.sum
      expect(total).to eq(15)
      expect(distribution[:formative]).to be > 0
    end
  end

  describe ".extract_genres" do
    it "extracts unique genres from ranked artists" do
      artists = [
        { "genres" => ["pop", "dance pop"] },
        { "genres" => ["pop", "rock"] },
        { "genres" => ["indie rock"] },
      ]

      genres = described_class.extract_genres(artists, 50)
      expect(genres).to contain_exactly("pop", "dance pop", "rock", "indie rock")
    end

    it "limits to top N artists" do
      artists = Array.new(60) { |i| { "genres" => ["genre_#{i}"] } }

      genres = described_class.extract_genres(artists, 10)
      expect(genres.length).to eq(10)
    end
  end

  describe ".expand_genres" do
    it "expands known genres to include related genres" do
      user_genres = ["indie rock", "pop"]
      expanded = described_class.expand_genres(user_genres)

      expect(expanded).to include("indie rock", "pop")
      expect(expanded).to include("alternative rock", "indie pop", "modern rock") # related to indie rock
      expect(expanded).to include("dance pop", "electropop", "alternative pop")   # related to pop
    end

    it "preserves unknown genres without expansion" do
      user_genres = ["obscure genre"]
      expanded = described_class.expand_genres(user_genres)

      expect(expanded).to include("obscure genre")
    end
  end
end
```

#### GREEN: Implement (`app/services/era_calculator.rb`)

```ruby
class EraCalculator
  CURRENT_YEAR = 2026

  GENRE_MAP = {
    "indie rock" => ["alternative rock", "indie pop", "modern rock"],
    "indie pop" => ["indie rock", "alternative pop", "dream pop"],
    "alternative rock" => ["indie rock", "modern rock", "rock"],
    "pop" => ["dance pop", "electropop", "alternative pop"],
    "hip hop" => ["rap", "trap", "underground hip hop"],
    "electronic" => ["electro", "edm", "house"],
    "r&b" => ["neo soul", "alternative r&b", "soul"],
  }.freeze

  def self.calculate_era_ranges(birth_year)
    [
      {
        name: "formative",
        year_range: "#{birth_year + 10}-#{birth_year + 12}",
        age_range: "10-12",
        years: [birth_year + 10, birth_year + 12]
      },
      {
        name: "high_school",
        year_range: "#{birth_year + 14}-#{birth_year + 18}",
        age_range: "14-18",
        years: [birth_year + 14, birth_year + 18]
      },
      {
        name: "college",
        year_range: "#{birth_year + 18}-#{birth_year + 22}",
        age_range: "18-22",
        years: [birth_year + 18, birth_year + 22]
      },
      {
        name: "recent",
        year_range: "2023-2025",
        age_range: "recent",
        years: [2023, 2025]
      },
      {
        name: "current",
        year_range: CURRENT_YEAR.to_s,
        age_range: "current",
        years: [CURRENT_YEAR, CURRENT_YEAR]
      }
    ]
  end

  def self.distribute_era_track_count(target_count)
    formative_count = (target_count * 0.30).floor
    current_count = [(target_count * 0.10).floor, 3].max

    remaining = target_count - formative_count - current_count
    per_middle_era = remaining / 3
    remainder = remaining - (per_middle_era * 3)

    {
      formative: formative_count + remainder,
      high_school: per_middle_era,
      college: per_middle_era,
      recent: per_middle_era,
      current: current_count
    }
  end

  def self.extract_genres(ranked_artists, limit = 50)
    ranked_artists.first(limit)
      .flat_map { |a| a["genres"] || [] }
      .uniq
  end

  def self.expand_genres(user_genres)
    expanded = Set.new(user_genres)

    user_genres.each do |genre|
      related = GENRE_MAP[genre.downcase]
      related&.each { |g| expanded.add(g) }
    end

    expanded.to_a
  end
end
```

### 3B. SpotifyAuthService

Port from `src/auth/oauth.js`.

#### RED: Spec (`spec/services/spotify_auth_service_spec.rb`)

Test all four functions: `generate_pkce`, `authorization_url`, `exchange_code`, `refresh_tokens`. Use WebMock for HTTP calls to `https://accounts.spotify.com/api/token`.

Key test cases:
- `generate_pkce` returns `{ verifier:, challenge: }` with valid base64url strings
- `authorization_url` builds correct URL with all params (client_id, response_type, redirect_uri, scopes, state, code_challenge_method, code_challenge)
- `exchange_code` POSTs to token endpoint, returns `{ access_token:, refresh_token:, expires_in: }`
- `exchange_code` raises on error response
- `refresh_tokens` POSTs with grant_type=refresh_token, returns new tokens
- `refresh_tokens` preserves original refresh_token if Spotify doesn't return a new one

#### GREEN: Implement (`app/services/spotify_auth_service.rb`)

```ruby
class SpotifyAuthService
  TOKEN_URL = "https://accounts.spotify.com/api/token"
  AUTHORIZE_URL = "https://accounts.spotify.com/authorize"

  SCOPES = %w[
    user-top-read user-read-recently-played
    playlist-modify-public playlist-modify-private playlist-read-private
    user-read-private streaming
    user-read-playback-state user-modify-playback-state
  ].freeze

  def self.generate_pkce
    verifier = SecureRandom.urlsafe_base64(32)
    challenge = Base64.urlsafe_encode64(
      Digest::SHA256.digest(verifier), padding: false
    )
    { verifier: verifier, challenge: challenge }
  end

  def self.authorization_url(state:, code_challenge:)
    params = {
      client_id: ENV["SPOTIFY_CLIENT_ID"],
      response_type: "code",
      redirect_uri: ENV["SPOTIFY_REDIRECT_URI"],
      scope: SCOPES.join(" "),
      state: state,
      code_challenge_method: "S256",
      code_challenge: code_challenge
    }
    "#{AUTHORIZE_URL}?#{params.to_query}"
  end

  def self.exchange_code(code:, code_verifier:)
    response = Faraday.post(TOKEN_URL) do |req|
      req.headers["Content-Type"] = "application/x-www-form-urlencoded"
      req.body = {
        client_id: ENV["SPOTIFY_CLIENT_ID"],
        client_secret: ENV["SPOTIFY_CLIENT_SECRET"],
        grant_type: "authorization_code",
        code: code,
        redirect_uri: ENV["SPOTIFY_REDIRECT_URI"],
        code_verifier: code_verifier
      }
    end

    handle_token_response(response)
  end

  def self.refresh_tokens(refresh_token)
    response = Faraday.post(TOKEN_URL) do |req|
      req.headers["Content-Type"] = "application/x-www-form-urlencoded"
      req.body = {
        client_id: ENV["SPOTIFY_CLIENT_ID"],
        client_secret: ENV["SPOTIFY_CLIENT_SECRET"],
        grant_type: "refresh_token",
        refresh_token: refresh_token
      }
    end

    data = handle_token_response(response)
    # Spotify may not return a new refresh token
    data[:refresh_token] ||= refresh_token
    data
  end

  private_class_method def self.handle_token_response(response)
    body = JSON.parse(response.body)

    unless response.success?
      raise SpotifyAuthError, body["error_description"] || body["error"]
    end

    {
      access_token: body["access_token"],
      refresh_token: body["refresh_token"],
      expires_in: body["expires_in"]
    }
  end
end

class SpotifyAuthError < StandardError; end
```

### 3C. SpotifyApiClient

Port from `src/api/spotify-client.js`. This is initialized with a `User` record and auto-refreshes tokens on 401 responses.

#### RED: Spec (`spec/services/spotify_api_client_spec.rb`)

Key test cases (all HTTP calls mocked with WebMock):
- Constructor requires a User with valid tokens
- `#current_user` calls `GET /me`
- `#top_artists(time_range, limit)` calls correct endpoint
- `#top_tracks(time_range, limit)` calls correct endpoint
- `#search(query, types, limit)` URL-encodes query
- `#get_recommendations(params)` builds query string from seed params
- `#get_artist_top_tracks(artist_id)` calls correct endpoint
- `#create_playlist(name, options)` POSTs to user's playlists endpoint
- `#add_tracks_to_playlist(playlist_id, uris)` handles chunking at 100
- `#replace_playlist_tracks(playlist_id, uris)` uses PUT
- Auto-refresh: when a request returns 401, refreshes token and retries
- Rate limit: when a request returns 429 with Retry-After header, waits and retries (mock sleep)

#### GREEN: Implement (`app/services/spotify_api_client.rb`)

```ruby
class SpotifyApiClient
  BASE_URL = "https://api.spotify.com/v1"
  MAX_TRACKS_PER_REQUEST = 100

  def initialize(user)
    @user = user
  end

  def current_user
    get("/me")
  end

  def top_artists(time_range: "medium_term", limit: 50)
    get("/me/top/artists", time_range: time_range, limit: limit)
  end

  def top_tracks(time_range: "medium_term", limit: 50)
    get("/me/top/tracks", time_range: time_range, limit: limit)
  end

  def search(query, types: ["track"], limit: 20)
    get("/search", q: query, type: types.join(","), limit: limit)
  end

  def get_recommendations(seed_genres: [], seed_artists: [], seed_tracks: [], **params)
    query = params.merge(limit: params[:limit] || 20)
    query[:seed_genres] = seed_genres.first(5).join(",") if seed_genres.any?
    query[:seed_artists] = seed_artists.first(5).join(",") if seed_artists.any?
    query[:seed_tracks] = seed_tracks.first(5).join(",") if seed_tracks.any?
    get("/recommendations", **query)
  end

  def get_artist_top_tracks(artist_id, market: "US")
    get("/artists/#{artist_id}/top-tracks", market: market)
  end

  def related_artists(artist_id)
    get("/artists/#{artist_id}/related-artists")
  end

  def create_playlist(name, description: "", public: true)
    user_data = current_user
    post("/users/#{user_data['id']}/playlists", {
      name: name, description: description, public: public
    })
  end

  def add_tracks_to_playlist(playlist_id, track_uris)
    track_uris.each_slice(MAX_TRACKS_PER_REQUEST) do |chunk|
      post("/playlists/#{playlist_id}/tracks", { uris: chunk })
    end
  end

  def replace_playlist_tracks(playlist_id, track_uris)
    put("/playlists/#{playlist_id}/tracks", { uris: track_uris.first(MAX_TRACKS_PER_REQUEST) })

    # Add remaining tracks if > 100
    if track_uris.length > MAX_TRACKS_PER_REQUEST
      track_uris[MAX_TRACKS_PER_REQUEST..].each_slice(MAX_TRACKS_PER_REQUEST) do |chunk|
        post("/playlists/#{playlist_id}/tracks", { uris: chunk })
      end
    end
  end

  private

  def get(path, **params)
    request(:get, path, params: params)
  end

  def post(path, body)
    request(:post, path, body: body.to_json)
  end

  def put(path, body)
    request(:put, path, body: body.to_json)
  end

  def request(method, path, retried: false, **options)
    ensure_valid_token!

    url = "#{BASE_URL}#{path}"
    response = connection.public_send(method, url) do |req|
      req.headers["Authorization"] = "Bearer #{@user.access_token}"
      req.params = options[:params] if options[:params]
      if options[:body]
        req.headers["Content-Type"] = "application/json"
        req.body = options[:body]
      end
    end

    handle_response(response, method, path, retried, **options)
  end

  def handle_response(response, method, path, retried, **options)
    case response.status
    when 200..299
      response.status == 204 ? nil : JSON.parse(response.body)
    when 401
      raise SpotifyApiError, "Token refresh failed" if retried
      refresh_user_token!
      request(method, path, retried: true, **options)
    when 429
      retry_after = (response.headers["Retry-After"] || "1").to_i
      sleep(retry_after)
      request(method, path, retried: retried, **options)
    else
      body = JSON.parse(response.body) rescue {}
      raise SpotifyApiError, "Spotify API error (#{response.status}): #{body.dig('error', 'message') || response.reason_phrase}"
    end
  end

  def ensure_valid_token!
    refresh_user_token! if @user.token_expired?
  end

  def refresh_user_token!
    tokens = SpotifyAuthService.refresh_tokens(@user.refresh_token)
    @user.update!(
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      token_expires_at: tokens[:expires_in].seconds.from_now
    )
  end

  def connection
    @connection ||= Faraday.new
  end
end

class SpotifyApiError < StandardError; end
```

### 3D. TopItemsAnalyzer

Port from `src/analysis/top-items-analyzer.js`.

#### RED: Spec (`spec/services/top_items_analyzer_spec.rb`)

Key test cases:
- `#analyze` fetches top artists and tracks across all 3 time ranges
- `#analyze_artists` weights artists by position, finds consistent favorites, ranks genres
- `#analyze_tracks` weights tracks by position, finds consistent favorites
- `#calculate_weight(position, total)` returns 1.0 for position 0, ~0.1 for last position
- Weight formula: `1 - (position / total) * 0.9`

Mock `SpotifyApiClient` to return fixture data for top_artists and top_tracks calls.

#### GREEN: Implement (`app/services/top_items_analyzer.rb`)

Port the logic directly. Key methods:
- `initialize(spotify_client)` -- takes a SpotifyApiClient instance
- `analyze` -- fetches all data, returns `{ raw:, analysis: { artists:, tracks: } }`
- `fetch_top_artists` -- loops over 3 time ranges
- `fetch_top_tracks` -- loops over 3 time ranges
- `analyze_artists(artists_by_time_range)` -- weight + rank + genres
- `analyze_tracks(tracks_by_time_range)` -- weight + rank
- `calculate_weight(position, total)` -- `1 - (position.to_f / total) * 0.9`

### 3E. PlaylistGeneratorService

Port from `src/playlist/birthday-playlist-generator.js`. This is the most complex service.

#### RED: Spec (`spec/services/playlist_generator_service_spec.rb`)

Key test cases:
- `#generate` returns tracks split into favorites, genre_discoveries, era_hits
- `#generate` respects target_count (default 125)
- `#generate` respects exclude_track_ids (for lock-aware regeneration)
- `#select_favorites` scores by `user_weight * 0.8 + popularity/100 * 0.2`, max 3 per artist
- `#get_genre_discoveries` excludes top 50 artists, requires popularity >= 60
- `#get_era_hits` distributes across eras using EraCalculator
- `#get_era_hits` includes nostalgic artists for formative era
- `#intelligent_shuffle` interleaves 2 from each category, then shuffles within groups of 6
- Track counts: 30% favorites + 30% genre discoveries + 40% era hits = target

Mock SpotifyApiClient for all external calls.

#### GREEN: Implement (`app/services/playlist_generator_service.rb`)

```ruby
class PlaylistGeneratorService
  TARGET_SONG_COUNT = 125
  FAVORITES_RATIO = 0.3
  GENRE_DISCOVERY_RATIO = 0.3
  MIN_POPULARITY = 60
  MAX_PER_ARTIST = 3
  SEARCH_GENRES = %w[pop rock hip\ hop r&b].freeze

  def initialize(spotify_client)
    @client = spotify_client
  end

  def generate(analysis_data, birth_year:, target_count: TARGET_SONG_COUNT, exclude_track_ids: [])
    favorites_count = (target_count * FAVORITES_RATIO).floor
    genre_discovery_count = (target_count * GENRE_DISCOVERY_RATIO).floor
    era_hits_count = target_count - favorites_count - genre_discovery_count

    all_track_ids = Set.new(exclude_track_ids)

    favorites = select_favorites(analysis_data[:tracks][:ranked_tracks], favorites_count)
    favorites.each { |t| all_track_ids.add(t["id"]) }

    genre_discoveries = get_genre_discoveries(
      analysis_data[:artists][:ranked_artists], genre_discovery_count, all_track_ids
    )
    genre_discoveries.each { |t| all_track_ids.add(t["id"]) }

    era_hits = get_era_hits(birth_year, era_hits_count, all_track_ids)
    era_hits.each { |t| all_track_ids.add(t["id"]) }

    all_tracks = intelligent_shuffle(favorites, genre_discoveries, era_hits)

    {
      tracks: all_tracks,
      favorites: favorites,
      genre_discoveries: genre_discoveries,
      era_hits: era_hits,
      stats: {
        total_tracks: all_tracks.length,
        from_favorites: favorites.length,
        from_genre_discovery: genre_discoveries.length,
        from_era_hits: era_hits.length,
        birth_year: birth_year
      }
    }
  end

  # ... (port remaining methods from birthday-playlist-generator.js)
  # select_favorites, get_genre_discoveries, get_era_hits,
  # search_era_hits, intelligent_shuffle, light_shuffle
end
```

Port each method faithfully from the JS source. Key behavioral details:

**select_favorites:**
- Score = `total_weight * 0.8 + (popularity || 50) / 100.0 * 0.2`
- Sort descending by score
- Max 3 tracks per primary artist
- Tag with `source: "favorite"`

**get_genre_discoveries:**
- Extract genres from top 50 artists via `EraCalculator.extract_genres`
- Expand via `EraCalculator.expand_genres`
- Strategy 1: Search Spotify by `genre:"<genre>"` for top 10 genres, take 3 eligible per genre
- Strategy 2: Use recommendations API with genre seeds for remainder
- Eligible = not seen, popularity >= 60, primary artist not in top 50
- Tag with `source: "genre_discovery"`

**get_era_hits:**
- Calculate ranges via `EraCalculator.calculate_era_ranges`
- Distribute counts via `EraCalculator.distribute_era_track_count`
- For formative era: fetch nostalgic artists from user's `nostalgic_artists` records, search for each artist, get their top tracks (max 2 per artist)
- For all eras: search by `year:<range> genre:<genre>` for genres: pop, rock, hip hop, r&b
- Eligible = not seen, popularity >= 60
- Tag with `source: "era_hit"`

**intelligent_shuffle:**
- Interleave: take 2 from favorites, 2 from genre_discoveries, 2 from era_hits, repeat
- Then Fisher-Yates shuffle within groups of 6

---

## Phase 4: Auth Flow (TDD)

### 4A. ApplicationController

```ruby
class ApplicationController < ActionController::API
  include ActionController::Cookies

  private

  def current_user
    @current_user ||= User.find_by(id: session[:user_id])
  end

  def authenticate_user!
    render json: { error: "Not authenticated" }, status: :unauthorized unless current_user
  end
end
```

### 4B. AuthController

#### RED: Request specs (`spec/requests/auth_spec.rb`)

Key test cases:
- `GET /auth/spotify` redirects to Spotify authorize URL with correct params
- `GET /auth/spotify` stores state and code_verifier in session
- `GET /auth/spotify/callback` with valid code: exchanges code, upserts user, sets session, redirects to FRONTEND_URL
- `GET /auth/spotify/callback` with new user: creates user with Spotify profile data and seeds nostalgic artists
- `GET /auth/spotify/callback` with existing user: updates tokens
- `GET /auth/spotify/callback` with state mismatch: returns 422
- `GET /auth/spotify/callback` with error param: redirects to frontend with error
- `DELETE /auth/logout` clears session, returns 200

#### GREEN: Implement

**Routes (`config/routes.rb`):**

```ruby
Rails.application.routes.draw do
  # Auth routes (no namespace)
  get "auth/spotify", to: "auth#spotify"
  get "auth/spotify/callback", to: "auth#callback"
  delete "auth/logout", to: "auth#logout"

  # API routes
  namespace :api do
    get "me", to: "users#show"
    patch "me", to: "users#update"
    get "token", to: "users#token"

    resources :nostalgic_artists, only: [:index, :create, :destroy]

    get "analysis", to: "analysis#show"

    resources :playlists, only: [:index, :show, :create, :update, :destroy] do
      member do
        post :generate
        post :publish
      end
    end

    get "search", to: "search#index"

    post "player/play", to: "player#play"
    post "player/pause", to: "player#pause"
    post "player/next", to: "player#next_track"
    post "player/previous", to: "player#previous_track"
  end
end
```

**AuthController (`app/controllers/auth_controller.rb`):**

```ruby
class AuthController < ApplicationController
  def spotify
    pkce = SpotifyAuthService.generate_pkce
    state = SecureRandom.hex(16)

    session[:oauth_state] = state
    session[:code_verifier] = pkce[:verifier]

    redirect_to SpotifyAuthService.authorization_url(
      state: state, code_challenge: pkce[:challenge]
    ), allow_other_host: true
  end

  def callback
    if params[:error].present?
      redirect_to "#{frontend_url}?error=#{params[:error]}", allow_other_host: true
      return
    end

    if params[:state] != session[:oauth_state]
      render json: { error: "State mismatch" }, status: :unprocessable_entity
      return
    end

    tokens = SpotifyAuthService.exchange_code(
      code: params[:code],
      code_verifier: session.delete(:code_verifier)
    )
    session.delete(:oauth_state)

    spotify_client = build_temporary_client(tokens)
    profile = spotify_client.current_user

    user = User.find_or_initialize_by(spotify_id: profile["id"])
    user.assign_attributes(
      display_name: profile["display_name"],
      email: profile["email"],
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      token_expires_at: tokens[:expires_in].seconds.from_now
    )
    user.save!

    session[:user_id] = user.id
    redirect_to frontend_url, allow_other_host: true
  end

  def logout
    session.delete(:user_id)
    head :ok
  end

  private

  def frontend_url
    ENV.fetch("FRONTEND_URL", "http://localhost:5173")
  end

  def build_temporary_client(tokens)
    # Build a temporary user-like object for the initial profile fetch
    temp_user = User.new(
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      token_expires_at: tokens[:expires_in].seconds.from_now
    )
    SpotifyApiClient.new(temp_user)
  end
end
```

### 4C. React Auth Integration

Build these in Phase 6 alongside routing, but design now:

**AuthContext** (`client/src/contexts/AuthContext.tsx`):
- Provides `{ user, isAuthenticated, isLoading, login, logout }`
- `login()` redirects to `${API_URL}/auth/spotify`
- `logout()` calls `DELETE /auth/logout`
- On mount, calls `GET /api/me` to check auth status

**ProtectedRoute** component:
- Wraps routes that require auth
- Redirects to login page if not authenticated

---

## Phase 5: API Endpoints (TDD)

For each controller, follow RED-GREEN-REFACTOR: write request specs first, then implement.

### 5A. UsersController

#### RED: Specs (`spec/requests/api/users_spec.rb`)

```ruby
# GET /api/me (authenticated) -> returns user profile
# GET /api/me (unauthenticated) -> 401
# PATCH /api/me { birth_year: 1985 } -> updates and returns user
# GET /api/token -> returns { access_token: "..." }
```

#### GREEN: Implement

```ruby
module Api
  class UsersController < ApplicationController
    before_action :authenticate_user!

    def show
      render json: UserSerializer.new(current_user)
    end

    def update
      if current_user.update(user_params)
        render json: UserSerializer.new(current_user)
      else
        render json: { errors: current_user.errors }, status: :unprocessable_entity
      end
    end

    def token
      render json: { access_token: current_user.access_token }
    end

    private

    def user_params
      params.permit(:birth_year)
    end
  end
end
```

Create a simple serializer (or use `as_json` override) to shape user output:

```ruby
# app/serializers/user_serializer.rb (plain Ruby, no gem needed)
class UserSerializer
  def initialize(user)
    @user = user
  end

  def as_json(*)
    {
      id: @user.id,
      spotify_id: @user.spotify_id,
      display_name: @user.display_name,
      email: @user.email,
      birth_year: @user.birth_year
    }
  end

  def to_json(*)
    as_json.to_json
  end
end
```

### 5B. NostalgicArtistsController

#### RED: Specs (`spec/requests/api/nostalgic_artists_spec.rb`)

```ruby
# GET /api/nostalgic_artists -> returns user's artists grouped or listed
# POST /api/nostalgic_artists { name: "Spice Girls", era: "formative" } -> creates and returns
# POST /api/nostalgic_artists with duplicate -> 422
# POST /api/nostalgic_artists with invalid era -> 422
# DELETE /api/nostalgic_artists/:id -> destroys and returns 204
# DELETE /api/nostalgic_artists/:id belonging to another user -> 404
```

#### GREEN: Implement

```ruby
module Api
  class NostalgicArtistsController < ApplicationController
    before_action :authenticate_user!

    def index
      artists = current_user.nostalgic_artists.order(:era, :name)
      render json: artists
    end

    def create
      artist = current_user.nostalgic_artists.build(nostalgic_artist_params)
      if artist.save
        render json: artist, status: :created
      else
        render json: { errors: artist.errors }, status: :unprocessable_entity
      end
    end

    def destroy
      artist = current_user.nostalgic_artists.find(params[:id])
      artist.destroy!
      head :no_content
    end

    private

    def nostalgic_artist_params
      params.permit(:name, :era)
    end
  end
end
```

### 5C. AnalysisController

#### RED: Specs (`spec/requests/api/analysis_spec.rb`)

```ruby
# GET /api/analysis -> runs TopItemsAnalyzer, returns structured analysis
# GET /api/analysis (unauthenticated) -> 401
```

Mock `TopItemsAnalyzer` or mock the underlying SpotifyApiClient calls.

#### GREEN: Implement

```ruby
module Api
  class AnalysisController < ApplicationController
    before_action :authenticate_user!

    def show
      client = SpotifyApiClient.new(current_user)
      analyzer = TopItemsAnalyzer.new(client)
      data = analyzer.analyze

      render json: {
        artists: {
          top_genres: data[:analysis][:artists][:top_genres],
          ranked_artists: data[:analysis][:artists][:ranked_artists].first(50),
          consistent_favorites: data[:analysis][:artists][:consistent_favorites].first(20),
          total_unique_artists: data[:analysis][:artists][:total_unique_artists]
        },
        tracks: {
          ranked_tracks: data[:analysis][:tracks][:ranked_tracks].first(50),
          consistent_favorites: data[:analysis][:tracks][:consistent_favorites].first(20),
          total_unique_tracks: data[:analysis][:tracks][:total_unique_tracks]
        }
      }
    end
  end
end
```

### 5D. PlaylistsController

This is the largest controller. Port behaviors from `src/server/api-routes.js` and `src/public/js/app.js`.

#### RED: Specs (`spec/requests/api/playlists_spec.rb`)

```ruby
# GET /api/playlists -> returns user's playlists with track_count
# GET /api/playlists/:id -> returns playlist with ordered tracks
# GET /api/playlists/:id for another user's playlist -> 404
# POST /api/playlists { name: "My Playlist", birth_year: 1991 } -> creates empty playlist
# PATCH /api/playlists/:id { name: "New Name", tracks: [...] } -> auto-save (replaces all playlist_tracks)
# PATCH /api/playlists/:id with tracks -> upserts Track records, replaces PlaylistTracks
# DELETE /api/playlists/:id -> destroys playlist
# POST /api/playlists/:id/generate { birth_year: 1991, locked_track_ids: [...] } -> generates tracks
# POST /api/playlists/:id/publish -> creates/updates Spotify playlist
```

#### GREEN: Implement

```ruby
module Api
  class PlaylistsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_playlist, only: [:show, :update, :destroy, :generate, :publish]

    def index
      playlists = current_user.playlists.order(updated_at: :desc)
      render json: playlists.map { |p|
        p.as_json(only: [:id, :name, :spotify_playlist_id, :published_at, :birth_year, :created_at, :updated_at])
         .merge(track_count: p.track_count)
      }
    end

    def show
      render json: playlist_with_tracks
    end

    def create
      playlist = current_user.playlists.build(playlist_create_params)
      if playlist.save
        render json: playlist, status: :created
      else
        render json: { errors: playlist.errors }, status: :unprocessable_entity
      end
    end

    def update
      ActiveRecord::Base.transaction do
        @playlist.update!(name: params[:name]) if params[:name].present?

        if params[:tracks].present?
          replace_playlist_tracks(params[:tracks])
        end
      end

      render json: playlist_with_tracks
    end

    def destroy
      @playlist.destroy!
      head :no_content
    end

    def generate
      client = SpotifyApiClient.new(current_user)
      analyzer = TopItemsAnalyzer.new(client)
      analysis_data = analyzer.analyze

      generator = PlaylistGeneratorService.new(client)
      birth_year = params[:birth_year] || @playlist.effective_birth_year
      locked_track_ids = params[:locked_track_ids] || []

      result = generator.generate(
        analysis_data[:analysis],
        birth_year: birth_year.to_i,
        target_count: 125 - locked_track_ids.length,
        exclude_track_ids: locked_track_ids
      )

      render json: {
        tracks: result[:tracks],
        stats: result[:stats]
      }
    end

    def publish
      client = SpotifyApiClient.new(current_user)
      track_uris = @playlist.playlist_tracks.includes(:track).map { |pt| pt.track.uri }

      if @playlist.published?
        client.replace_playlist_tracks(@playlist.spotify_playlist_id, track_uris)
      else
        spotify_playlist = client.create_playlist(
          @playlist.name,
          description: @playlist.description || "Created with Birthday Playlist Analyzer"
        )
        client.add_tracks_to_playlist(spotify_playlist["id"], track_uris)
        @playlist.update!(
          spotify_playlist_id: spotify_playlist["id"],
          published_at: Time.current
        )
      end

      render json: {
        spotify_playlist_id: @playlist.spotify_playlist_id,
        published_at: @playlist.published_at
      }
    end

    private

    def set_playlist
      @playlist = current_user.playlists.find(params[:id])
    end

    def playlist_create_params
      params.permit(:name, :birth_year)
    end

    def playlist_with_tracks
      tracks_data = @playlist.playlist_tracks.includes(:track).order(:position).map do |pt|
        pt.track.as_json.merge(
          position: pt.position,
          locked: pt.locked,
          source: pt.source
        )
      end

      @playlist.as_json.merge(tracks: tracks_data)
    end

    def replace_playlist_tracks(tracks_params)
      @playlist.playlist_tracks.destroy_all

      tracks_params.each do |track_data|
        track = Track.find_or_initialize_by(spotify_id: track_data[:spotify_id])
        track.update!(
          name: track_data[:name],
          artist_names: track_data[:artist_names] || [],
          album_name: track_data[:album_name],
          album_art_url: track_data[:album_art_url],
          duration_ms: track_data[:duration_ms],
          popularity: track_data[:popularity],
          preview_url: track_data[:preview_url],
          uri: track_data[:uri]
        )

        @playlist.playlist_tracks.create!(
          track: track,
          position: track_data[:position],
          locked: track_data[:locked] || false,
          source: track_data[:source] || "manual"
        )
      end
    end
  end
end
```

### 5E. SearchController

#### RED: Specs

```ruby
# GET /api/search?q=bohemian -> returns tracks from Spotify search
# GET /api/search without q -> 400
# GET /api/search?q=test&limit=5 -> respects limit
```

#### GREEN: Implement

```ruby
module Api
  class SearchController < ApplicationController
    before_action :authenticate_user!

    def index
      query = params[:q]
      return render json: { error: "Query parameter 'q' is required" }, status: :bad_request if query.blank?

      limit = [params.fetch(:limit, 20).to_i, 50].min
      client = SpotifyApiClient.new(current_user)
      results = client.search(query, types: ["track"], limit: limit)

      render json: { tracks: results.dig("tracks", "items") || [] }
    end
  end
end
```

### 5F. PlayerController

#### RED: Specs

```ruby
# POST /api/player/play with { device_id, uris } -> 200
# POST /api/player/pause -> 200
# POST /api/player/next -> 200
# POST /api/player/previous -> 200
# All endpoints require auth -> 401 when unauthenticated
```

#### GREEN: Implement

```ruby
module Api
  class PlayerController < ApplicationController
    before_action :authenticate_user!

    def play
      client = SpotifyApiClient.new(current_user)
      body = {}
      body[:uris] = params[:uris] if params[:uris]
      body[:context_uri] = params[:context_uri] if params[:context_uri]
      body[:offset] = params[:offset] if params[:offset]

      query = params[:device_id] ? "?device_id=#{params[:device_id]}" : ""
      client.put("/me/player/play#{query}", body)
      head :ok
    end

    def pause
      client = SpotifyApiClient.new(current_user)
      query = params[:device_id] ? "?device_id=#{params[:device_id]}" : ""
      client.put("/me/player/pause#{query}", {})
      head :ok
    end

    def next_track
      client = SpotifyApiClient.new(current_user)
      query = params[:device_id] ? "?device_id=#{params[:device_id]}" : ""
      client.post_raw("/me/player/next#{query}", {})
      head :ok
    end

    def previous_track
      client = SpotifyApiClient.new(current_user)
      query = params[:device_id] ? "?device_id=#{params[:device_id]}" : ""
      client.post_raw("/me/player/previous#{query}", {})
      head :ok
    end
  end
end
```

Note: `SpotifyApiClient` will need public `put` and `post_raw` methods (or a generic `request` method exposed) for player control endpoints. Add these during implementation.

---

## Phase 6: React Core UI

### 6A. TypeScript Types (`client/src/types/index.ts`)

```typescript
export interface User {
  id: number;
  spotify_id: string;
  display_name: string;
  email: string;
  birth_year: number;
}

export interface NostalgicArtist {
  id: number;
  name: string;
  era: "formative" | "high_school" | "college";
}

export interface Track {
  spotify_id: string;
  name: string;
  artist_names: string[];
  album_name: string;
  album_art_url: string;
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
  uri: string;
}

export interface PlaylistTrack extends Track {
  position: number;
  locked: boolean;
  source: "favorite" | "genre_discovery" | "era_hit" | "manual";
}

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  spotify_playlist_id: string | null;
  published_at: string | null;
  birth_year: number | null;
  track_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlaylistWithTracks extends Playlist {
  tracks: PlaylistTrack[];
}

export interface AnalysisData {
  artists: {
    top_genres: Array<{ genre: string; weight: number }>;
    ranked_artists: SpotifyArtist[];
    consistent_favorites: SpotifyArtist[];
    total_unique_artists: number;
  };
  tracks: {
    ranked_tracks: SpotifyTrack[];
    consistent_favorites: SpotifyTrack[];
    total_unique_tracks: number;
  };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: Array<{ url: string }>;
  popularity: number;
  totalWeight: number;
  timeRanges: string[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
  uri: string;
  preview_url: string | null;
  popularity: number;
}

export interface GenerateResult {
  tracks: SpotifyTrack[];
  stats: {
    total_tracks: number;
    from_favorites: number;
    from_genre_discovery: number;
    from_era_hits: number;
    birth_year: number;
  };
}
```

### 6B. API Client Functions (`client/src/api/endpoints.ts`)

```typescript
import apiClient from "./client";
import type {
  User, NostalgicArtist, Playlist, PlaylistWithTracks,
  AnalysisData, GenerateResult, SpotifyTrack
} from "../types";

// Auth
export const getCurrentUser = () => apiClient.get<User>("/api/me");
export const updateUser = (data: { birth_year: number }) => apiClient.patch<User>("/api/me", data);
export const getAccessToken = () => apiClient.get<{ access_token: string }>("/api/token");
export const logout = () => apiClient.delete("/auth/logout");

// Nostalgic Artists
export const getNostalgicArtists = () => apiClient.get<NostalgicArtist[]>("/api/nostalgic_artists");
export const createNostalgicArtist = (data: { name: string; era: string }) =>
  apiClient.post<NostalgicArtist>("/api/nostalgic_artists", data);
export const deleteNostalgicArtist = (id: number) =>
  apiClient.delete(`/api/nostalgic_artists/${id}`);

// Analysis
export const getAnalysis = () => apiClient.get<AnalysisData>("/api/analysis");

// Playlists
export const getPlaylists = () => apiClient.get<Playlist[]>("/api/playlists");
export const getPlaylist = (id: number) => apiClient.get<PlaylistWithTracks>(`/api/playlists/${id}`);
export const createPlaylist = (data: { name: string; birth_year?: number }) =>
  apiClient.post<Playlist>("/api/playlists", data);
export const updatePlaylist = (id: number, data: unknown) =>
  apiClient.patch<PlaylistWithTracks>(`/api/playlists/${id}`, data);
export const deletePlaylist = (id: number) => apiClient.delete(`/api/playlists/${id}`);
export const generatePlaylistTracks = (id: number, data: {
  birth_year?: number;
  locked_track_ids?: string[];
}) => apiClient.post<GenerateResult>(`/api/playlists/${id}/generate`, data);
export const publishPlaylist = (id: number) =>
  apiClient.post(`/api/playlists/${id}/publish`);

// Search
export const searchTracks = (q: string, limit = 20) =>
  apiClient.get<{ tracks: SpotifyTrack[] }>("/api/search", { params: { q, limit } });

// Player
export const playerPlay = (data: { device_id: string; uris?: string[] }) =>
  apiClient.post("/api/player/play", data);
export const playerPause = (data: { device_id: string }) =>
  apiClient.post("/api/player/pause", data);
export const playerNext = (data: { device_id: string }) =>
  apiClient.post("/api/player/next", data);
export const playerPrevious = (data: { device_id: string }) =>
  apiClient.post("/api/player/previous", data);
```

### 6C. Routing (`client/src/App.tsx`)

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import PlaylistListPage from "./pages/PlaylistListPage";
import PlaylistEditorPage from "./pages/PlaylistEditorPage";
import AnalysisPage from "./pages/AnalysisPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/playlists" element={<PlaylistListPage />} />
              <Route path="/playlists/:id" element={<PlaylistEditorPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

### 6D. AuthContext (`client/src/contexts/AuthContext.tsx`)

- On mount, call `GET /api/me`
- If 200: set `user` state, `isAuthenticated = true`
- If 401: set `isAuthenticated = false`
- `login()`: `window.location.href = "${API_URL}/auth/spotify"`
- `logout()`: call `DELETE /auth/logout`, clear state, navigate to `/`

### 6E. AppLayout + Header

- `AppLayout`: renders `<Header />`, `<Outlet />` (react-router), and `<PlayerBar />`
- `Header`: logo, user display name, nav links (Playlists, Analysis), logout button

### 6F. LoginPage

- Centered card with app title, description, "Connect with Spotify" button
- If already authenticated, redirect to `/playlists`
- Style reference: existing login page in `src/auth/server.js` (dark theme, green Spotify button)

### 6G. PlaylistListPage

- Fetch playlists via `useQuery` from `@tanstack/react-query`
- Display list of playlists with name, track count, created date
- "Create New Playlist" button -> calls `POST /api/playlists` -> navigates to `/playlists/:id`
- Delete button per playlist

---

## Phase 7: Playlist Editor

### 7A. PlaylistEditorPage (`client/src/pages/PlaylistEditorPage.tsx`)

Container component. Fetches playlist by ID from URL params. Manages local track state.

State:
```typescript
const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
const [playlistName, setPlaylistName] = useState("");
```

### 7B. PlaylistHeader

- Editable playlist name input (large, styled like `playlist-name-input` in existing CSS)
- Stats: track count, total duration
- Actions: Regenerate button, Publish to Spotify button

### 7C. TrackItem Component

Port from `UI.createTrackElement` in `src/public/js/app.js`.

Props:
```typescript
interface TrackItemProps {
  track: PlaylistTrack;
  index: number;
  onPlay: (uri: string) => void;
  onLockToggle: (trackId: string) => void;
  onRemove: (index: number) => void;
  isPlaying: boolean;
}
```

Rendering:
- Drag handle (6 dots icon)
- Track number
- Play button (appears on hover, replaces track number)
- Album art (40x40)
- Track name + artist names
- Duration
- Lock toggle button (lock/unlock icon, green when locked)
- Remove button (X)

Locked styling: `bg-[rgba(29,185,84,0.15)]` (from existing CSS `.track-item.locked`)

### 7D. PlaylistTrackList with Drag-and-Drop

Use `@hello-pangea/dnd`:

```tsx
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

<DragDropContext onDragEnd={handleDragEnd}>
  <Droppable droppableId="playlist">
    {(provided) => (
      <ul ref={provided.innerRef} {...provided.droppableProps}>
        {tracks.map((track, index) => (
          <Draggable key={track.spotify_id} draggableId={track.spotify_id} index={index}>
            {(provided, snapshot) => (
              <li ref={provided.innerRef} {...provided.draggableProps}>
                <TrackItem
                  track={track}
                  index={index}
                  dragHandleProps={provided.dragHandleProps}
                  isDragging={snapshot.isDragging}
                  // ... other props
                />
              </li>
            )}
          </Draggable>
        ))}
        {provided.placeholder}
      </ul>
    )}
  </Droppable>
</DragDropContext>
```

`handleDragEnd`: reorder tracks array, update positions, trigger auto-save.

### 7E. useAutoSave Hook

```typescript
function useAutoSave(playlistId: number, tracks: PlaylistTrack[], name: string) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      updatePlaylist(playlistId, {
        name,
        tracks: tracks.map((t, i) => ({
          spotify_id: t.spotify_id,
          name: t.name,
          artist_names: t.artist_names,
          album_name: t.album_name,
          album_art_url: t.album_art_url,
          duration_ms: t.duration_ms,
          popularity: t.popularity,
          preview_url: t.preview_url,
          uri: t.uri,
          position: i,
          locked: t.locked,
          source: t.source,
        })),
      });
    }, 500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [playlistId, tracks, name]);
}
```

### 7F. SearchBar + SearchResults

- Debounced search input (300ms, like existing code)
- Results dropdown below input
- Each result has an "Add" button
- Adding a track: check for duplicates (by spotify_id), append to end, trigger auto-save
- Use `useQuery` with `enabled: query.length > 0`

### 7G. RegenerateButton

- Calls `POST /api/playlists/:id/generate` with locked track IDs
- On response: merge locked tracks at original positions with new tracks (port `mergeLockedTracks` from `src/public/js/app.js`)
- Disabled when all tracks are locked

Merge algorithm (from existing JS):
```typescript
function mergeLockedTracks(
  newTracks: SpotifyTrack[],
  lockedTracks: PlaylistTrack[],
  lockedPositions: Map<string, number>
): PlaylistTrack[] {
  const totalCount = newTracks.length + lockedTracks.length;
  const merged = new Array(totalCount);

  // Place locked tracks at their original positions
  for (const track of lockedTracks) {
    const position = lockedPositions.get(track.spotify_id)!;
    const safePosition = Math.min(position, totalCount - 1);
    merged[safePosition] = track;
  }

  // Fill remaining slots with new tracks
  let newIndex = 0;
  for (let i = 0; i < totalCount; i++) {
    if (!merged[i] && newIndex < newTracks.length) {
      merged[i] = convertToPlaylistTrack(newTracks[newIndex++]);
    }
  }

  return merged.filter(Boolean);
}
```

---

## Phase 8: Track Locking

### 8A. Lock Toggle

- Button next to remove button in TrackItem
- Click toggles `locked` boolean on the track in local state
- No confirmation needed (simple toggle)
- Visual: locked tracks get `bg-[rgba(29,185,84,0.15)]` background
- Lock icon: closed padlock when locked (green), open padlock when unlocked (gray)
- Lock/unlock triggers auto-save (which persists to database)

### 8B. Lock-Aware Regeneration

When user clicks "Regenerate":
1. Collect locked tracks and their positions
2. Calculate `targetCount = 125 - lockedTracks.length`
3. Collect locked track spotify_ids as `excludeTrackIds`
4. Call `POST /api/playlists/:id/generate` with `{ locked_track_ids: excludeTrackIds }`
5. Merge response tracks with locked tracks using `mergeLockedTracks`
6. Update local state, trigger auto-save

### 8C. All-Locked State

- When `tracks.every(t => t.locked)` is true:
  - Disable regenerate button
  - If user tries to click, show alert: "All tracks are locked. Unlock all tracks to regenerate?"
  - Alert has "Unlock All" option -> clears all locks, triggers auto-save

---

## Phase 9: Nostalgic Artists + Config

### 9A. PlaylistConfig Component

Rendered inside PlaylistEditor, above the track list.

- Birth year input (number, default from user profile)
- Changing birth year updates the playlist's `birth_year` field via auto-save

### 9B. NostalgicArtistsEditor Component

- Fetches nostalgic artists via `GET /api/nostalgic_artists`
- Groups by era (formative, high_school, college)
- Each artist: name + delete button
- Add form: text input for name + era dropdown + "Add" button
- POST/DELETE trigger React Query invalidation
- Default artists seeded on user creation (NSYNC, Backstreet Boys, Smash Mouth, Britney Spears, Christina Aguilera -- all "formative")

---

## Phase 10: Player + Analysis

### 10A. Spotify Web Playback SDK

Port from `src/public/js/player.js`.

#### useSpotifyPlayer Hook (`client/src/hooks/useSpotifyPlayer.ts`)

```typescript
interface PlayerState {
  isReady: boolean;
  deviceId: string | null;
  currentTrack: CurrentTrack | null;
  isPaused: boolean;
  position: number;
  duration: number;
}

interface CurrentTrack {
  id: string;
  name: string;
  artists: string;
  album: string;
  albumArt: string;
  uri: string;
}

function useSpotifyPlayer(): {
  state: PlayerState;
  playTrack: (uri: string) => Promise<void>;
  playTracks: (uris: string[], offset?: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
}
```

Implementation:
1. Load Spotify Web Playback SDK script (`https://sdk.scdn.co/spotify-player.js`)
2. Create `Spotify.Player` instance with `getOAuthToken` callback that calls `GET /api/token`
3. Listen for `ready`, `not_ready`, `player_state_changed`, error events
4. Playback control: call backend player endpoints which proxy to Spotify API
5. Player name: "Birthday Playlist Analyzer"
6. Default volume: 0.5

#### PlayerBar Component

Fixed position bottom bar (port from existing CSS `.player-container`):
- Left: Album art (56x56), track name, artist name
- Center: Previous, Play/Pause, Next buttons
- Right: Status text

Only visible when player is ready (requires Spotify Premium).

### 10B. AnalysisPage

Port from `AnalysisView` in `src/public/js/app.js`.

- Fetch via `GET /api/analysis`
- Tabs: Genres, Artists, Tracks, Favorites
- Stats cards: total unique artists, total unique tracks
- Genre list with scores
- Artist list with images, genres, weight
- Track list with album art, play button
- Consistent favorites section

Use existing CSS class references for Tailwind mapping:
- `.analysis-grid` -> Tailwind grid
- `.analysis-card` -> Tailwind card styling
- `.stat-large` -> large number in accent color
- `.artist-image` -> 48px circle
- Track items reuse `TrackItem` component (without lock/remove actions)

---

## Phase 11: Polish

### 11A. Error Handling

- Axios interceptor: on 401 response, redirect to login
- React error boundaries for component-level errors
- Toast notifications for API errors (consider a simple toast system or use `react-hot-toast`)
- Graceful handling of token expiry mid-session

### 11B. Loading States

- Skeleton loaders for playlist list and track list
- Spinner for analysis loading (port existing `.spinner` CSS)
- Disabled buttons during async operations
- Loading indicator in search results

### 11C. Responsive Design

Reference existing CSS media queries:
- Stack header vertically on mobile
- Single-column player on mobile
- Single-column analysis grid on mobile
- Smaller playlist name font on mobile

Tailwind responsive classes: `sm:`, `md:`, `lg:` breakpoints.

### 11D. LAN Access

- Rails: already binds to `0.0.0.0` by default (or configure in `config/puma.rb`)
- Vite: configured with `host: "0.0.0.0"` in vite.config.ts
- Add LAN IP Spotify redirect URI in Spotify Developer Dashboard
- CORS: add LAN IP to allowed origins (or use a wildcard pattern for development)

### 11E. README Update

Update README.md to document:
- New stack (Rails 8 + React + TypeScript)
- Setup instructions (install deps, create DB, configure env vars)
- How to run both servers
- How to run tests

---

## Appendix A: Design Tokens (Tailwind Reference)

Map from existing CSS variables to Tailwind config:

```
--bg-primary: #121212      -> bg-neutral-950 (or custom)
--bg-secondary: #181818    -> custom "surface"
--bg-tertiary: #282828     -> custom "surface-hover"
--text-primary: #ffffff    -> text-white
--text-secondary: #b3b3b3  -> text-neutral-400
--text-muted: #6a6a6a      -> text-neutral-500
--accent: #1DB954          -> custom "spotify" or "accent"
--accent-hover: #1ed760    -> custom "accent-hover"
--border: #404040          -> border-neutral-700
--error: #e74c3c           -> text-red-500
```

Consider extending `tailwind.config.ts` with custom colors to match the existing dark Spotify-inspired theme.

## Appendix B: File Structure Reference

### Rails (`/api`)

```
api/
  app/
    controllers/
      application_controller.rb
      auth_controller.rb
      api/
        users_controller.rb
        nostalgic_artists_controller.rb
        analysis_controller.rb
        playlists_controller.rb
        search_controller.rb
        player_controller.rb
    models/
      user.rb
      nostalgic_artist.rb
      playlist.rb
      track.rb
      playlist_track.rb
    serializers/
      user_serializer.rb
    services/
      era_calculator.rb
      spotify_auth_service.rb
      spotify_api_client.rb
      top_items_analyzer.rb
      playlist_generator_service.rb
  config/
    routes.rb
    initializers/
      cors.rb
      lockbox.rb
  db/
    migrate/
      ..._create_users.rb
      ..._create_nostalgic_artists.rb
      ..._create_playlists.rb
      ..._create_tracks.rb
      ..._create_playlist_tracks.rb
  spec/
    models/
      user_spec.rb
      nostalgic_artist_spec.rb
      playlist_spec.rb
      track_spec.rb
      playlist_track_spec.rb
    services/
      era_calculator_spec.rb
      spotify_auth_service_spec.rb
      spotify_api_client_spec.rb
      top_items_analyzer_spec.rb
      playlist_generator_service_spec.rb
    requests/
      auth_spec.rb
      api/
        users_spec.rb
        nostalgic_artists_spec.rb
        analysis_spec.rb
        playlists_spec.rb
        search_spec.rb
        player_spec.rb
    factories/
      users.rb
      nostalgic_artists.rb
      playlists.rb
      tracks.rb
      playlist_tracks.rb
    support/
      webmock.rb
```

### React (`/client`)

```
client/
  src/
    api/
      client.ts
      endpoints.ts
    components/
      AppLayout.tsx
      Header.tsx
      PlayerBar.tsx
      PlaylistTrackList.tsx
      TrackItem.tsx
      SearchBar.tsx
      SearchResults.tsx
      PlaylistConfig.tsx
      NostalgicArtistsEditor.tsx
      RegenerateButton.tsx
    contexts/
      AuthContext.tsx
    hooks/
      useAuth.ts
      useAutoSave.ts
      useSpotifyPlayer.ts
      useSearch.ts
    pages/
      LoginPage.tsx
      PlaylistListPage.tsx
      PlaylistEditorPage.tsx
      AnalysisPage.tsx
    types/
      index.ts
    test/
      setup.ts
    App.tsx
    main.tsx
    index.css
  .env
  vite.config.ts
  tsconfig.json
  package.json
```

## Appendix C: Running the Application

### Development

Terminal 1 (Rails):
```bash
cd /Users/irosen419/code/birthday-playlist-analyzer/api
bin/rails db:create db:migrate
bin/rails server -b 0.0.0.0
```

Terminal 2 (React):
```bash
cd /Users/irosen419/code/birthday-playlist-analyzer/client
npm run dev
```

### Testing

```bash
# Rails
cd api && bundle exec rspec

# React
cd client && npx vitest run
```

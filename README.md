# Birthday Playlist Analyzer

A full-stack web application that analyzes your Spotify listening history and generates the perfect birthday party playlist. Built with a Rails 8 API backend and a React TypeScript frontend.

## Features

- **Spotify OAuth Authentication** -- Secure token-based authentication via Spotify OAuth 2.0 (JWT + `Authorization: Bearer` header)
- **Email Allowlist** -- Optional `ALLOWED_EMAILS` gate to restrict sign-up to a known list of Spotify accounts
- **Music History Analysis** -- Analyzes your top artists and tracks across multiple time ranges
- **Smart Playlist Generation** -- Creates party playlists using a configurable blend of favorites, genre discoveries, and era-appropriate hits
- **Per-Playlist Config** -- Customize ratios and song count per playlist
- **Nostalgic Artists** -- Specify artists from your formative years, high school, and college eras to influence playlist generation
- **Drag-and-Drop Editor** -- Reorder, lock, add, and remove tracks with a full playlist editor
- **Lock / Lock All / Shuffle** -- Lock tracks in place so regeneration works around them, or shuffle the unlocked ones
- **Track Search** -- Search Spotify's catalog and add tracks directly to your playlist
- **Publish to Spotify** -- Push your curated playlist directly to your Spotify account and jump to it in-app
- **Integrated Playback** -- Preview tracks with the built-in Spotify Web Playback SDK player (Premium required)
- **Auto-Save** -- All changes are automatically saved as you edit
- **Rate Limiting** -- `rack-attack` throttles abusive traffic
- **Responsive Design** -- Works on desktop and mobile devices (mobile Safari included)

## Tech Stack

- **Backend:** Rails 8 (API mode) with PostgreSQL
- **Frontend:** React 19 + TypeScript + Tailwind CSS 4
- **State Management:** TanStack React Query
- **Drag & Drop:** @hello-pangea/dnd
- **HTTP Client:** Axios
- **Routing:** React Router 7
- **Bundler:** Vite 8

## Prerequisites

- Ruby 3.3+
- Node.js 20.19+
- PostgreSQL 16+
- A [Spotify Developer](https://developer.spotify.com/dashboard) application

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd birthday-playlist-analyzer
```

### 2. Spotify Developer Dashboard

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application (or select an existing one)
3. Add `http://localhost:3000/auth/spotify/callback` to the **Redirect URIs**
4. Note your **Client ID** and **Client Secret**

### 3. API setup (Rails)

```bash
cd api
bundle install
bin/rails db:create db:migrate

# Configure credentials (add your Spotify client_id and client_secret)
bin/rails credentials:edit
```

Your credentials should include:

```yaml
spotify:
  client_id: your_client_id
  client_secret: your_client_secret
```

### 4. Client setup (React)

```bash
cd client
npm install
```

Create a `.env` file if you need to point to a non-default API URL:

```
VITE_API_URL=http://localhost:3000
```

## Running the App

Start both servers in separate terminals:

**Terminal 1 -- Rails API (port 3000):**

```bash
cd api
bin/rails server
```

**Terminal 2 -- Vite dev server (port 5173):**

```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
birthday-playlist-analyzer/
├── api/                          # Rails 8 API
│   ├── app/
│   │   ├── controllers/          # API controllers
│   │   ├── models/               # ActiveRecord models
│   │   └── services/             # Service objects (Spotify client, playlist generator, etc.)
│   ├── config/
│   │   └── routes.rb             # API routes
│   └── db/
│       └── migrate/              # Database migrations
│
├── client/                       # React TypeScript frontend
│   ├── src/
│   │   ├── api/                  # API client and endpoint modules
│   │   ├── components/
│   │   │   ├── analysis/         # Music analysis views
│   │   │   ├── auth/             # Login page
│   │   │   ├── common/           # Shared components (LoadingSpinner, etc.)
│   │   │   ├── layout/           # Header, AppLayout
│   │   │   ├── player/           # Spotify Web Playback SDK player bar
│   │   │   ├── playlist/         # Playlist editor, track list, nostalgic artists
│   │   │   └── search/           # Track search
│   │   ├── context/              # React context (Auth)
│   │   ├── hooks/                # Custom hooks (auto-save, Spotify player)
│   │   └── types/                # TypeScript type definitions
│   └── vite.config.ts
│
└── README.md
```

## Deployment

This repository ships with a `render.yaml` blueprint for one-click deployment to [Render.com](https://render.com). The blueprint provisions:

- A free PostgreSQL database (`birthday-playlist-db`)
- The Rails API as a web service (`birthday-playlist-api`)
- The React client as a static site (`birthday-playlist`)

### Step-by-step

1. **Push the repo to GitHub.** Fork this repository (or push your own copy) to a GitHub account that Render can access.

2. **Create a Render account** at [render.com](https://render.com) and connect your GitHub account.

3. **Create a new Blueprint.** In the Render dashboard click **New +** then **Blueprint**, select this repository, and confirm. Render will read `render.yaml` and create the database, API, and static site automatically.

4. **Set the secret environment variables.** Several variables in `render.yaml` are marked `sync: false` and must be filled in by hand from the Render dashboard before the first successful deploy.

   On the **birthday-playlist-api** service:

   | Variable | Value |
   | --- | --- |
   | `RAILS_MASTER_KEY` | Contents of `api/config/master.key` from your local checkout |
   | `LOCKBOX_MASTER_KEY` | Generate locally with `ruby -rlockbox -e "puts Lockbox.generate_key"` (or `bin/rails runner 'puts Lockbox.generate_key'`) |
   | `SPOTIFY_CLIENT_ID` | From your Spotify Developer Dashboard app |
   | `SPOTIFY_CLIENT_SECRET` | From your Spotify Developer Dashboard app |
   | `SPOTIFY_REDIRECT_URI` | `https://birthday-playlist-api.onrender.com/auth/spotify/callback` |
   | `FRONTEND_URL` | `https://birthday-playlist.onrender.com` |
   | `ALLOWED_EMAILS` | Optional comma-separated allowlist (e.g. `you@example.com,friend@example.com`). Leave blank to allow any authenticated Spotify user. |

   On the **birthday-playlist** static site:

   | Variable | Value |
   | --- | --- |
   | `VITE_API_URL` | `https://birthday-playlist-api.onrender.com` |

5. **Update the Spotify Developer Dashboard.** Add `https://birthday-playlist-api.onrender.com/auth/spotify/callback` as an allowed Redirect URI on your Spotify application.

6. **Deploy.** Trigger a manual deploy on each service (or push a new commit). The first deploy will run `bundle install && bundle exec rails db:migrate` for the API and `npm install && npm run build` for the client.

7. **Verify.** Visit `https://birthday-playlist.onrender.com`, sign in with Spotify, and confirm the OAuth round-trip succeeds.

> **Note:** Render's free tier spins services down after periods of inactivity, so the first request after a quiet stretch may take ~30 seconds while the API cold-starts.

## License

MIT

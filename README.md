# Birthday Playlist Analyzer

A full-stack web application that analyzes your Spotify listening history and generates the perfect birthday party playlist. Built with a Rails 8 API backend and a React TypeScript frontend.

## Features

- **Spotify OAuth Authentication** -- Secure session-based authentication via Spotify OAuth 2.0
- **Music History Analysis** -- Analyzes your top artists and tracks across multiple time ranges
- **Smart Playlist Generation** -- Creates party playlists using a blend of your favorites, genre discoveries, and era-appropriate hits
- **Nostalgic Artists** -- Specify artists from your formative years, high school, and college eras to influence playlist generation
- **Drag-and-Drop Editor** -- Reorder, lock, add, and remove tracks with a full playlist editor
- **Track Search** -- Search Spotify's catalog and add tracks directly to your playlist
- **Publish to Spotify** -- Push your curated playlist directly to your Spotify account
- **Integrated Playback** -- Preview tracks with the built-in Spotify Web Playback SDK player
- **Auto-Save** -- All changes are automatically saved as you edit
- **Responsive Design** -- Works on desktop and mobile devices

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

## License

MIT

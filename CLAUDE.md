# Project Context

Read this first. This document is the single source of truth for future Claude sessions working on this repo. Keep it updated as decisions change.

---

## What this is

A full-stack web app that analyzes a user's Spotify listening history and generates a personalized birthday party playlist. Live at **https://birthday-playlist.onrender.com** (Render free tier, first request after idle may take ~30s to cold-start).

Originally a Node/Express/vanilla JS CLI. Rewritten in-place to a Rails 8 API + React TypeScript monorepo (see `docs/PLAN.md` for the rewrite plan). The old Node app files were removed.

---

## Tech stack

| Layer    | Tech                                          | Port |
|----------|-----------------------------------------------|------|
| Backend  | Rails 8.0 (API mode), Ruby 3.3.5, PostgreSQL | 3000 |
| Frontend | React 19 + TypeScript + Vite 8 + Tailwind 4  | 5173 |
| Auth     | Spotify OAuth 2.0 + PKCE → JWT Bearer tokens  | —    |
| Testing  | RSpec (Rails), no frontend tests              | —    |
| Deploy   | Render (Blueprint via `render.yaml`)          | —    |

---

## Architecture

```
birthday-playlist-analyzer/
├── api/                    Rails 8 API
│   ├── app/
│   │   ├── controllers/    Auth + namespaced /api/* controllers
│   │   ├── models/         User, Playlist, Track, PlaylistTrack, NostalgicArtist
│   │   └── services/       Spotify + generator + auth token service objects
│   ├── config/
│   │   ├── routes.rb
│   │   ├── initializers/   rack_attack, cors, lockbox, wrap_parameters
│   │   └── application.rb  Manually re-adds cookie+session middleware (for OAuth state only)
│   └── spec/               RSpec tests (229+ passing)
│
├── client/                 React + TypeScript + Vite + Tailwind
│   ├── src/
│   │   ├── api/            Axios client + per-endpoint modules
│   │   ├── components/     layout/ auth/ playlist/ search/ analysis/ player/ common/
│   │   ├── context/        AuthContext, PlayerContext
│   │   ├── hooks/          useAutoSave, useSpotifyPlayer
│   │   ├── lib/            auth.ts (localStorage token wrapper)
│   │   └── types/          All TS interfaces
│   └── vite.config.ts
│
├── render.yaml             Render Blueprint (defines db + API + static site)
├── docs/
│   ├── PLAN.md             Original full-rewrite implementation plan (reference)
│   ├── POST-HOSTING.md     Security/hardening checklist with current progress
│   ├── IMPLEMENTATION_SUMMARY.md  Historical rewrite summary
│   ├── PR-FOLLOWUPS.md     Follow-up work filed from PR reviews
│   └── WISHLIST.md         User wishlist (nice-to-haves, unscheduled)
└── CLAUDE.md               ← you are here
```

---

## Run it locally

Two terminals:

```bash
# Terminal 1 — Rails API
cd api
bin/rails server              # http://localhost:3000

# Terminal 2 — React client
cd client
npm run dev                    # http://localhost:5173
```

Requires Ruby 3.3+, Node 20.19+, PostgreSQL 16+. On first checkout: `cd api && bundle install && bin/rails db:create db:migrate && cd ../client && npm install`.

`.env` files at `api/.env` and `client/.env` (gitignored) hold secrets. See `api/.env.example` and `client/.env.example` for the required keys.

---

## Features that ship today

- Spotify OAuth (server-side PKCE) → app issues JWT, frontend stores it in `localStorage`
- Email allowlist (`ALLOWED_EMAILS` env var; blank = open)
- Onboarding page collects birth year on first login
- Settings page (display name, birth year)
- Music analysis (top artists/tracks/genres across 3 time ranges)
- Playlist generator (**30% favorites / 30% genre discoveries / 40% era hits** by default; all ratios are configurable per playlist)
- Target song count configurable per playlist (default 125, range 50–200)
- Nostalgic artists per user, grouped into formative/high-school/college eras, configurable via Spotify artist autocomplete
- Playlist editor: drag-and-drop reorder, lock/unlock per track, Lock All / Unlock All, Shuffle (reorders the list, not playback), search + add, remove
- Auto-save (500ms debounced, sends full track list)
- Regenerate with lock awareness (generates `targetCount - lockedCount` new tracks, merges locked ones back at their original positions)
- Publish to Spotify (creates or updates a Spotify playlist; shows a confirmation banner + "Open in Spotify" link)
- Spotify Web Playback SDK player (Premium required)
- `rack-attack` rate limiting (100/min general, 5/min generate, 30/min search, 10/5-min auth callback)
- Dependabot (weekly bundler/npm/actions updates)

---

## Key design decisions (the *why*)

### Auth is JWT Bearer tokens, not cookies
- Rails issues a JWT on successful OAuth and redirects to `${FRONTEND_URL}?auth_token=XXX`
- Frontend extracts it, saves to `localStorage`, strips it from the URL, sends `Authorization: Bearer` on every API request
- **Why:** Render gives the API and frontend different `*.onrender.com` subdomains. `.onrender.com` is on the Public Suffix List, so browsers treat them as cross-site. Mobile Safari blocks cross-site cookies, which broke cookie-based sessions. Tokens in `localStorage` are not affected.
- OAuth `state` + PKCE verifier still use short-lived session cookies during the Spotify round-trip (same-origin at that moment — browser navigates directly to the API domain for `/auth/spotify`).
- The session middleware is manually re-added in `api/config/application.rb` (API mode strips it by default). Session options must be passed **directly to the middleware call there** — setting them in a `config/initializers/*.rb` file is ignored because initializers run after the middleware stack is built.

### 30/30/40 generator with randomization
- See `api/app/services/playlist_generator_service.rb` and `era_calculator.rb`
- Randomization strategies: random Spotify search offset (0–80), weighted-random genre sampling (weighted reservoir), score jitter on favorites, shuffled genre query order for era hits
- Per-playlist config lives on the `playlists` table (`favorites_ratio`, `discovery_ratio`, `era_hits_ratio`, `target_song_count`)
- Ratio sum validation happens in `PlaylistsController#generate`, **not** in the model — otherwise auto-save fails mid-edit while the user is typing percentages
- Deduplication uses `"name|artist"` signatures (stripping parenthesized text) in addition to Spotify IDs, because the same song appears under different IDs on different albums/compilations

### Auto-save state management
- `PlaylistEditor` keeps local state (tracks, name, lockedTrackIds, birthYear, generationConfig)
- `useAutoSave` debounces the PATCH to the server
- The local state is only hydrated from `useQuery` data **when the playlist ID changes** (not on every refetch). Hydrating on every refetch caused tracks to disappear after regeneration because the refetch would return stale DB data before auto-save completed.

### Params wrapping
- Some controllers (playlists, nostalgic_artists) accept params wrapped in a top-level key (`{ "playlist": { ... } }`) because the frontend sends them that way. Strong params check for both wrapped and unwrapped shapes. Rails' global `wrap_parameters false` initializer exists but doesn't fully override controller-level behavior in all cases, so the controller params code is defensive.

### Solid Cache/Queue/Cable removed
- Rails 8 ships with `solid_cache`, `solid_queue`, `solid_cable` — all of which require separate DBs
- Render's free Postgres tier only allows one database
- These gems are commented out in the Gemfile, and production uses `memory_store` for cache + `async` for ActiveJob

---

## Deployment (Render)

Defined by `render.yaml` — three resources:
- `birthday-playlist-db` (Postgres, free)
- `birthday-playlist-api` (Rails web service, free)
- `birthday-playlist` (React static site)

Env vars marked `sync: false` in `render.yaml` must be set manually in the Render dashboard:

**On `birthday-playlist-api`:**
| Var | Value |
|---|---|
| `RAILS_MASTER_KEY` | from `api/config/master.key` locally |
| `LOCKBOX_MASTER_KEY` | generated once, rotate via `previous_versions` if leaked |
| `SPOTIFY_CLIENT_ID` | from Spotify Dashboard |
| `SPOTIFY_CLIENT_SECRET` | from Spotify Dashboard |
| `SPOTIFY_REDIRECT_URI` | `https://birthday-playlist-api.onrender.com/auth/spotify/callback` |
| `FRONTEND_URL` | `https://birthday-playlist.onrender.com` |
| `ALLOWED_EMAILS` | comma-separated, leave blank for open signup |

**On `birthday-playlist`:**
| Var | Value |
|---|---|
| `VITE_API_URL` | `https://birthday-playlist-api.onrender.com` |

Push to `master` → Render auto-deploys both services. First request after idle takes ~30–60s (cold start).

---

## Gotchas

- **Spotify 25-user cap**: Apps in Spotify's Development Mode can only have 25 registered test users. Each user must be added by hand in the Spotify Developer Dashboard → User Management → and their email must also be in `ALLOWED_EMAILS`. To exceed 25, request Extended Quota Mode from Spotify (takes a few days).
- **Spotify recommendations API**: Returns 404 for apps created after Nov 2024. The generator rescues `SpotifyApiError` in `fill_with_recommendations` and returns fewer tracks. Don't build new features on `/v1/recommendations`.
- **Spotify redirect URI must be `127.0.0.1`, not `localhost`**: Spotify's dashboard rejects `localhost` for new apps. Locally we use `http://127.0.0.1:3000/auth/spotify/callback`.
- **Cookie attributes in API mode**: Session options must be passed directly to `config.middleware.use ActionDispatch::Session::CookieStore` in `application.rb`. Setting them in `config/initializers/session_store.rb` is silently ignored.
- **Node 20.15 is too old** for Vite 8. Use Node 20.19+ (`nvm install 20.19.0 && nvm alias default 20.19.0`).
- **Cold starts on free tier**: First request after ~15 min of idle takes 30–60s. Long-running generates (which make many sequential Spotify API calls) can feel hung but usually complete.
- **Do not re-add `solid_cache`/`solid_queue`/`solid_cable`** without also provisioning separate databases or disabling them in production.

---

## Testing

- **Rails:** Strict RED → GREEN → REFACTOR TDD is required for all backend changes (enforced in user's global `~/.claude/CLAUDE.md`). Write the failing spec, confirm it fails with the expected error, then implement. Factories in `spec/factories/`. Tests run with `bundle exec rspec`. 229+ specs currently passing.
- **Frontend:** No tests. User explicitly opted out of Vitest. TypeScript compilation (`npx tsc -b`) is the only compile-time check — always run it before committing frontend changes because Render's production build will fail on unused imports, missing types, etc.
- **Specs at key layers:** `spec/models/`, `spec/services/`, `spec/requests/` (plus `spec/support/auth_helper.rb` with a `sign_in(user)` stub and an `auth_headers(user)` helper that issues a real JWT for end-to-end spec coverage).

---

## Working style for this repo

- **User preferences** (from `~/.claude/CLAUDE.md`):
  - Always use Test-Driven Development for code changes
  - Use the `clean-code-architect` agent when coding is involved
  - Always ask clarifying questions rather than assuming
  - Don't prompt for git add/commit actions
- **Do not create tests on the frontend** — user opted out; TypeScript compilation is the smoke test.
- **Before committing** any frontend change, run `cd client && npx tsc -b` — Vite's production build on Render fails on type errors, unused imports, etc.
- **Commit etiquette:** branch for non-trivial features (pattern: `feature/<name>`), merge with `--no-ff`, delete the branch after merge. Straight-to-master is fine for small fixes.
- **Before touching recently-reviewed code**, skim `docs/PR-FOLLOWUPS.md` — it tracks concrete items a reviewer flagged but didn't block the PR on. If what you're about to work on overlaps an entry there, consider closing the entry at the same time.
- **PR review tracking**: When reviewing a PR, create (or update) `docs/PR-REVIEW-{number}.md` to track findings, decisions, and deferred items across review rounds. On subsequent reviews of the same PR, check the existing doc to verify previously deferred items are still intentionally deferred. Delete the doc when the PR is merged. If docs from already-merged PRs exist, delete those too.
- **Memory files at `~/.claude/projects/-Users-irosen419-code-birthday-playlist-analyzer/memory/`** auto-load every session and complement this file with user-specific context (profile, preferences, running feature roadmap).

---

## Where to look for more detail

- **`docs/PLAN.md`** — the original full-rewrite implementation plan with the complete database schema, phase-by-phase breakdown, and file structure. Historical reference; don't use it as an up-to-date source.
- **`docs/POST-HOSTING.md`** — security/hardening checklist with current status. Has both "done" items (rate limiting, allowlist, Dependabot, payload cap, CSRF/token auth) and open items (Sentry, CSP, DB backups, field length validation).
- **`docs/IMPLEMENTATION_SUMMARY.md`** — historical summary of the Rails/React rewrite.
- **`docs/PR-REVIEW-{N}.md`** — live review tracker for an open PR. Created on first review, updated on re-reviews, deleted on merge. Check before acting on review comments to see if something was already considered.
- **`docs/PR-FOLLOWUPS.md`** — follow-up work surfaced by code reviews that wasn't in-scope for the PR itself. Check here before starting work that touches recently-reviewed code.
- **`docs/WISHLIST.md`** — nice-to-have features and ideas that aren't scheduled. Lower priority than `PR-FOLLOWUPS.md`.
- **`README.md`** — user-facing project description, setup instructions, deployment walkthrough.
- **`api/app/services/playlist_generator_service.rb`** — the heart of generation logic. Randomization, ratios, dedup, nostalgic artists, era hits, shuffle.
- **`client/src/components/playlist/PlaylistEditor.tsx`** — central hub for the editor; lots of state management lives here.

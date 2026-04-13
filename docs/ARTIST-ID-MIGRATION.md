# Artist ID Migration Plan

Persist stable Spotify artist IDs alongside artist names on `tracks` and `nostalgic_artists`, so every feature that reasons about "an artist" keys on the Spotify ID instead of a fuzzy name match.

## Why this matters

Today the codebase has **no stable artist identifier anywhere**:

- `tracks.artist_names` — jsonb array of strings (e.g. `["Smash Mouth"]`).
- `nostalgic_artists` — columns: `user_id`, `name`, `era`. No artist ID column.

Every artist-keyed operation is therefore name-based with collision risk:

- **Global per-artist cap** (shipped in PR that introduces this doc) keys on `downcase.strip(name)`. Two legitimately distinct artists sharing a name ("Nirvana" the grunge band vs. "Nirvana" the British 60s band; "Genesis" the prog band vs. gospel group) share a cap budget.
- **Nostalgic-artist pool dedup** also keys on normalized name.
- **Unique index on `nostalgic_artists`** is `[user_id, name, era]` — user adding the same artist they spelled slightly differently creates a duplicate row.
- **Any future feature** that asks "all tracks by artist X" falls back to `artist_names @> ARRAY[?]` jsonb matching.

The autocomplete flow on the nostalgic-artists editor **already fetches artist IDs from Spotify** and then throws them away before persisting. We're discarding data we need.

## Scope

Two tables, one frontend touch-up, and a backfill task.

### Schema changes

**`nostalgic_artists`**
- Add `spotify_artist_id :string` (nullable initially for backfill, then `null: false` after).
- Add new unique index `[user_id, spotify_artist_id, era]`.
- Drop old unique index `[user_id, name, era]` after backfill completes.
- Keep `name` column — used for display.

**`tracks`**
- Option 1: Upgrade `artist_names` jsonb from `["Name", ...]` to `[{ "id" => "...", "name" => "..." }, ...]`. Cleaner long-term, breaks existing serializer consumers.
- Option 2: Add parallel `artist_spotify_ids :jsonb, default: []`. Additive, easier to ship, mild duplication.
- **Recommendation:** Option 1. The jsonb shape is internal; bump both fields in one migration.

### Write-path updates

- `Track.upsert_from_spotify` — persist IDs alongside names. The Spotify track payload already includes `track.artists[].id`; currently only `.name` is kept.
- `NostalgicArtistsController#create` (or wherever autocomplete selections are persisted) — persist the `spotify_artist_id` from the autocomplete payload. The frontend already has it.
- `PlaylistsController#persist_generated_tracks` → `generator_track_to_symbols` — pass artist IDs through.

### Service-layer updates

- `PlaylistGeneratorService`:
  - Cap counter keys on `artist_spotify_id` instead of normalized name.
  - Nostalgic-artist pool dedup keys on `spotify_artist_id`.
  - `fetch_nostalgic_artist_tracks` looks up per-artist tracks by ID (already doing this; just wire up the stored ID instead of re-searching by name).

### Frontend updates

- `types/Track` and `types/NostalgicArtist` gain an `artistIds` / `spotifyArtistId` field.
- `NostalgicArtistsEditor` — no behavior change; it already has the IDs in its autocomplete state, just needs to pass them through on create.
- `PlaylistEditor`, track list components — no behavior change; artist names still display. IDs flow through silently.

### Backfill

Two distinct backfills, run as separate one-off rake tasks (or a single migration with two phases):

**1. `tracks` backfill (reliable)**
- Every row has a `spotify_id` (track ID). Spotify's `GET /tracks?ids=...` accepts up to 50 IDs per call and returns artist IDs for each.
- Batch in groups of 50, rate-limit (Spotify allows ~30 req/min on the common endpoints — add a 2s sleep between batches to be safe).
- Idempotent: re-running should no-op for rows already backfilled.
- Zero ambiguity — we're just enriching with data Spotify has for the exact track we already know.

**2. `nostalgic_artists` backfill (fuzzy)**
- Rows only have `name`. Use `GET /search?type=artist&q=<name>&limit=1` and take the top hit.
- **Ambiguity risk:** common names may match the wrong artist. Examples likely in the current data — probably none yet since the app has few users, but the risk scales with adoption.
- **Mitigations:**
  - Log every backfilled row with `(old_name, resolved_id, resolved_name, resolved_popularity)` for manual review.
  - Add an `unverified_backfill` boolean flag (default true for backfilled rows, false for new writes). Surface unverified rows in the Settings UI with a "Did we get this right?" prompt so users can correct mismatches before they propagate.
  - Alternatively, don't auto-backfill; require users to re-add their nostalgic artists via the autocomplete on next visit. Fewer moving parts, more friction.
- **Recommendation:** auto-backfill with the `unverified_backfill` flag + Settings-page review UI. Matches "low friction" goal without silently corrupting data.

### Unique index migration order

Can't drop `[user_id, name, era]` before backfill populates `spotify_artist_id` on every row. Sequence:

1. Migration 1: add `spotify_artist_id` (nullable), add NEW index `[user_id, spotify_artist_id, era]` (with `where: "spotify_artist_id IS NOT NULL"`).
2. Deploy writes that populate the new column.
3. Backfill task populates existing rows.
4. Migration 2: set `null: false`, rebuild index without the partial `where`, drop old `[user_id, name, era]` index.

## Risks

- **Spotify API quota:** tracks backfill is bounded (`COUNT(*) FROM tracks`) but could be a few hundred to a few thousand rows. At 50/batch and 2s between batches, backfilling 5000 tracks takes ~3 min. Acceptable.
- **Wrong artist match on nostalgic backfill** — mitigated by unverified-flag + review UI.
- **Breaking change to track serializer:** if external consumers depend on `artist_names` being `["string"]`, they break. Currently only the frontend consumes it; safe to change in lockstep.
- **Rollback:** if the migration ships bad, both column additions are reversible; Option 2 (parallel array) is safer to rollback than Option 1 (shape change). Reconsider picking Option 2 if rollback risk is a concern.

## Sequencing

Recommended rollout as a single PR:

1. Migrations (both phases).
2. Write-path updates (server + frontend).
3. Backfill rake tasks (run manually in prod after deploy).
4. Settings UI review prompt for unverified nostalgic artists.
5. Service-layer switch to ID-keyed operations (cap, dedup).
6. Final migration to enforce `null: false` + drop old index, run after backfill completes.

Approximately 2–3× the diff size of a typical bugfix PR. Worth its own review cycle — don't bundle with behavior changes.

## What this unblocks

- **Era-based Claude API feature** (top wishlist item) — Claude returns artist names, we resolve to IDs once and store them. No repeat fuzzy lookups.
- **"Block this artist" / "Show more from this artist"** features.
- **Reliable artist-level analytics** (e.g., "which artists show up most across this user's playlists").
- **`unfollow` flows** that need to identify an artist stably across Spotify API calls.
- **Removal of the name-collision risk** in the global per-artist cap shipped in the accompanying PR.

# Changelog

User-facing feature history, curated. Not a mirror of git log — only entries worth surfacing.

## Shipped

### Auth & hosting
- Spotify OAuth (server-side PKCE) with email allowlist and onboarding for birth year.
- JWT Bearer token auth (localStorage) replacing cookie sessions — fixed mobile Safari login on cross-site `*.onrender.com` subdomains. (#5)
- Auth edge-case hardening: safer `Bearer` parsing, URI-built redirect URLs. (#10)
- Deployed to Render via Blueprint; `rack-attack` rate limiting; Dependabot weekly updates.

### Playlist generation
- 30/30/40 generator (favorites / genre discoveries / era hits) with randomization (search offset, weighted genre sampling, score jitter).
- Per-playlist configurable ratios and target song count (30–200), persisted on the playlist.
- Exact song-count reconciliation — generator backfills from ranked tracks when buckets under-deliver. (#8)
- Regenerate respects locked tracks and flushes pending config edits before firing. (#8)
- Nostalgic artists pooled across all three eras with a global 4-per-artist cap and tiered popularity fallback. (#13)
- Nostalgic track labels reflect actual era(s).
- Removed default seeded nostalgic artists — new users start empty. (#11)

### Playlist editor
- Drag-and-drop reorder, per-track lock/unlock, Lock All / Unlock All, Shuffle, search-and-add, remove.
- Debounced auto-save (500ms) with local state as source of truth post-mutation.
- Configure generation before creating — new playlists open with config + nostalgic sections expanded; Cancel deletes the draft; abandoned drafts are cleaned up. (#12)
- Visual polish: primary-action hierarchy, sticky column header, hover play overlay, refined header. (#7)
- Scroll-to-top/bottom FAB aligned to content edge. (#9)
- Stronger delete confirmation for published playlists. (#12)

### Mobile
- Hide Web Playback SDK bar (mobile-unsupported); tap-to-open "Open in Spotify" popover. (#6)
- Always-visible lock/remove buttons; dedicated Move modal with top/bottom/position. (#6)
- Three row actions collapsed into a single `⋮` menu to reclaim title space. (#7)

### Publishing
- Publish to Spotify (creates or updates a user playlist) with confirmation + "Open in Spotify" link.
- Spotify Web Playback SDK player (Premium, desktop).

### Branding
- Rebranded from "Birthday Playlist Analyzer" to **EraPlay** — updated page title, login/onboarding headings and taglines, header nav, Spotify Connect device name, and favicon. (#15)

### Cleanup
- Deleted legacy Node/Express CLI (`src/`, ~5200 lines). (#11)

### Fixes
- Track search in the playlist editor returned no results — frontend expected a bare array but the endpoint wraps tracks under `{ tracks: [...] }`. Error was swallowed by a silent catch; catch now logs.

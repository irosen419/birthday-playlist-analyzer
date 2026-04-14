# User Wishlist

Nice-to-have features and half-formed ideas. Lower priority than `PR-FOLLOWUPS.md` (which tracks concrete concerns from code review) and `~/.claude/projects/.../memory/project_next_features.md` (which is the active roadmap).

Add things here freely. The bar is low. If an item graduates into real work, move it into the memory roadmap and delete it here.

When adding an item, use this shape:

```
### <short title>
<one or two sentences on what it is and why it would be nice>
```

---

## Features

### Era-based artist generation via Claude API
Replace any hardcoded default nostalgic artists with dynamically generated top 5–10 artists per life era (ages 10–12, high school ~14–18, college ~18–22, +TBD) derived from the honoree's birth year. Claude API acts as the oracle: prompt it for artist names per era, then resolve those names to Spotify artist IDs for playlist building. Claude stays as the intelligence layer; Spotify stays as the playback/playlist layer. Last.fm `chart.getTopArtists` was considered as an alternative but adds a dependency. Cost for personal use is negligible (~500–1000 tokens per request, fractions of a cent per playlist); if it ever grows, Batch API (50% off, 24h async) and prompt caching are available levers.

For this to work well, Nostalgic Artists need to live on a User and Playlist level. Users should be able to search for, lock in, remove and re-roll nostalgic artists. If they explicitly remove an artist, that artist should still be searchable but not appear in a re-roll, which means they'll need to somehow be built into the Claude prompt.

## Bugs

### Persist Spotify artist IDs on tracks and nostalgic artists
**⚠️ High leverage — recommended as a prerequisite for most future artist-related work.** Today, `tracks.artist_names` is a jsonb array of strings and `nostalgic_artists` stores only `name` + `era`. No stable artist identifier is persisted anywhere, which forces every cross-artist operation (cap enforcement, dedup, "more from this artist", Claude-API era generation, unfollow-on-delete, etc.) to do fuzzy name matching — with real collision risk for common names ("Nirvana", "Genesis", "Eagles"). See `docs/ARTIST-ID-MIGRATION.md` for the full plan, scope, and backfill strategy. Blocks clean implementation of the Era-based Claude API feature above.

### Unfollow Spotify playlist on delete
When a user deletes a playlist that has been published to Spotify, we currently only delete the local DB record — the Spotify playlist is orphaned in their account. Consider calling `DELETE /v1/playlists/{id}/followers` (Spotify's "unfollow" endpoint, which is how owners delete their own playlists) as part of destroy. Should probably be opt-in via an extra confirmation (e.g., "Also remove from Spotify?") rather than automatic.

## UX polish

_(empty)_

## Developer experience

_(empty)_

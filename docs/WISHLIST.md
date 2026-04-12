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

### Generation Config Before Every Playlist Creation
When the user clicks Create Playlist, before the playlist is actually generated, a modal should appear with the generation settings (ratios, target song count) and options for nostalgic artist entry. This applies to every new playlist, not just the first — each playlist gets independently configured from the start. The config component should be extracted out since it already lives on the playlist page.

### Era-based artist generation via Claude API
Replace any hardcoded default nostalgic artists with dynamically generated top 5–10 artists per life era (ages 10–12, high school ~14–18, college ~18–22, +TBD) derived from the honoree's birth year. Claude API acts as the oracle: prompt it for artist names per era, then resolve those names to Spotify artist IDs for playlist building. Claude stays as the intelligence layer; Spotify stays as the playback/playlist layer. Last.fm `chart.getTopArtists` was considered as an alternative but adds a dependency. Cost for personal use is negligible (~500–1000 tokens per request, fractions of a cent per playlist); if it ever grows, Batch API (50% off, 24h async) and prompt caching are available levers.

For this to work well, Nostalgic Artists need to live on a User and Playlist level. Users should be able to search for, lock in, remove and re-roll nostalgic artists. If they explicitly remove an artist, that artist should still be searchable but not appear in a re-roll, which means they'll need to somehow be built into the Claude prompt.

## Bugs

### Nostalgic artists barely influence generation
Rework how nostalgic artists feed into playlist generation. Current behavior (in `api/app/services/playlist_generator_service.rb`):
- Only the **formative** era (ages 10–12) actually consults `user.nostalgic_artists`. Entries tagged `high_school` or `college` are silently ignored. All three eras should contribute.
- The era groupings should be treated as a UX nicety for organizing the user's picks — not as a hard gate that decides whether the artist is used.
- The `.first(2)` cap in `fetch_nostalgic_artist_tracks` only caps tracks picked from that function. Favorites/discovery buckets can independently add more tracks by the same artist (e.g., 3 Smash Mouth songs appeared in a generated playlist). There should be a global per-artist cap across all buckets.
- Spotify's `popularity` field (0–100, global play counts with recency weighting) filters out lower-popularity nostalgic tracks via `MIN_POPULARITY = 60`. For nostalgic artists the user explicitly chose, this threshold may be too aggressive — consider lowering or removing it for nostalgic-artist picks specifically.

### Unfollow Spotify playlist on delete
When a user deletes a playlist that has been published to Spotify, we currently only delete the local DB record — the Spotify playlist is orphaned in their account. Consider calling `DELETE /v1/playlists/{id}/followers` (Spotify's "unfollow" endpoint, which is how owners delete their own playlists) as part of destroy. Should probably be opt-in via an extra confirmation (e.g., "Also remove from Spotify?") rather than automatic.

## UX polish

_(empty)_

## Developer experience

_(empty)_

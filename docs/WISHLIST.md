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

## UX polish

_(empty)_

## Developer experience

_(empty)_

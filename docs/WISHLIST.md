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

## Bugs

### Generation percentage inputs don't allow free-text typing
The favorites / discovery / era-hits percentage fields in the generator config are restricted to preset values — users can't type an arbitrary number like `37`. They should accept any numeric input and only validate on submit/generate (validation currently lives in `PlaylistsController#generate` rather than the model, precisely so auto-save doesn't fail mid-edit).

### Song count config isn't respected exactly
Configuring target song count doesn't produce exactly that many tracks in the generated playlist — likely a rounding/math bug in how per-bucket counts are derived from ratios (`favorites_ratio`, `discovery_ratio`, `era_hits_ratio`). Fix: add a reconciliation step at the end of `PlaylistGeneratorService` that adds to or trims from the largest bucket to hit the exact target, correcting any off-by-one drift.

## UX polish

### Sticky scroll to top/bottom button
A floating button on the playlist editor that jumps to the top or bottom of the track list. With 125+ tracks and a locked-tracks-at-top layout, scrolling through the full list to reach the end (or back) is tedious.

## Developer experience

_(empty)_

# PR #8 Review — Fix generation settings: exact song count, loose ratios, flush-before-generate

Tracks review findings across review rounds. Deleted on merge.

---

## Review Round 1 (2026-04-11)

### Acted on

| # | Finding | Action |
|---|---------|--------|
| 3 | **flushSave race with defer-to-blur**: clicking Regenerate without blurring means the new ratio never reaches parent state, so flushSave persists stale config | Fix: force-commit local input values before flushSave |
| 10 | **`collect_overfetch_extras` bypasses `MAX_PER_ARTIST`**: reconciliation pulls from `ranked_tracks` without artist-count limits, risking artist concentration | Fix: add per-artist cap to `collect_overfetch_extras` |

### Acknowledged — will address as follow-ups

| # | Finding | Reason deferred |
|---|---------|-----------------|
| 1 | Reconciliation tracks are functionally favorites wearing a different label — stats can mislead | Correct observation but requires a deeper rethink of the reconciliation source pool; logging as follow-up |
| 2 | Over-delivery `.first(target_count)` truncates without adjusting per-bucket stats | Low likelihood in practice (buckets rarely over-deliver) but stats should be accurate; follow-up |
| 9 | No spec for the over-delivery truncation path | Follows from #2; add spec when fixing stats |
| 8 | WISHLIST entries added for bugs this PR fixes — should be removed or marked done | Will clean up in this PR |

### Declined — no action

| # | Finding | Reason |
|---|---------|--------|
| 4 | Balance button's 10s idle window has no UI visibility | Acceptable for now; the feature is a convenience shortcut, not a primary workflow |
| 5 | `onTouch` resets idle window on every keystroke | Intended behavior — idle means "stopped typing" |
| 6 | "Max is 100" warning on ratio inputs is noise since sum-to-100 is the real constraint | Low harm, provides immediate per-field feedback; keep |
| 7 | No migration needed but new enum value surfaces in `.sources.keys` | Confirmed no code iterates sources dynamically; safe |

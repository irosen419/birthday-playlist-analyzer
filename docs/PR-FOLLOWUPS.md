# PR Follow-Ups

Work that was surfaced during code review but was out of scope for the PR being reviewed. Items here are **real commitments** — they came from a reviewer flagging a concrete concern on merged code. Pick from the top when you have time.

**Status legend:** ✅ Done · ⏳ In progress · ⬜ Not started

When you finish an item, either strike it through and leave it for a release note, or delete it. If an item is promoted to the active roadmap, move it into `~/.claude/projects/.../memory/project_next_features.md` and delete it here.

When adding a new item, use this shape:

```
### ⬜ <short title>

**From:** PR #<number> — <PR title>
**Area:** <files or subsystem>
**Why:** <the concern the reviewer raised, in one or two sentences>
**Suggested approach:** <concrete next step, not a full design>
```

---

## Open

### ⬜ Use a dedicated JWT signing secret instead of `SECRET_KEY_BASE`

**From:** PR #5 — Switch to Bearer token auth (mobile Safari fix)
**Area:** `api/app/services/auth_token_service.rb`
**Why:** `AuthTokenService` signs tokens with `Rails.application.secret_key_base`. If that key ever needs to rotate (leak, routine rotation), every user is logged out *and* anything else derived from `secret_key_base` (encrypted credentials, signed cookies) rotates at the same time. Decoupling the JWT secret lets us rotate auth independently.
**Suggested approach:** Add a `JWT_SECRET` env var (generate with `SecureRandom.hex(64)`), read it in `AuthTokenService.secret` with a clear error if missing in production. Document in `CLAUDE.md` deploy table and `render.yaml`.

### ⬜ Add a token revocation path

**From:** PR #5 — Switch to Bearer token auth (mobile Safari fix)
**Area:** `api/app/services/auth_token_service.rb`, `api/app/controllers/application_controller.rb`, `users` table
**Why:** Logout currently only clears `localStorage`. The JWT stays valid server-side until its 30-day `exp`. If a token leaks (XSS, shared device, stolen laptop) there is no kill switch short of rotating the signing secret, which logs *everyone* out.
**Suggested approach:** Cheapest option — add a `tokens_valid_after` timestamp column on `users`, set it to `Time.current` on logout, and reject any decoded token whose `iat` is earlier. Include `iat` in the payload now so we don't need a second migration later. Optionally add a "log out everywhere" button in Settings.

### ⬜ Bump CSP work ahead of other nice-to-haves

**From:** PR #5 — Switch to Bearer token auth (mobile Safari fix)
**Area:** `docs/POST-HOSTING.md` §8, `api/config/initializers/content_security_policy.rb` (to be created)
**Why:** Auth tokens now live in `localStorage`, which is JS-accessible. Any XSS steals a 30-day session. CSP is the main defence-in-depth control against that, and it's currently parked under "Lower priority" in POST-HOSTING.md. It should move up.
**Suggested approach:** Start with the policy sketch already in `POST-HOSTING.md` §8, deploy in `Content-Security-Policy-Report-Only` mode first, watch Render logs for violations, then enforce. Don't forget `connect_src` needs `https://birthday-playlist-api.onrender.com` for axios calls.

### ⬜ Document the "local state is source of truth post-generate" tradeoff

**From:** PR #5 — Switch to Bearer token auth (mobile Safari fix)
**Area:** `client/src/components/playlist/PlaylistEditor.tsx` (around the `useEffect` keyed on `playlist?.id`)
**Why:** PR #5 fixed the disappearing-tracks bug by only hydrating local state when the playlist id changes, and removed the `invalidateQueries` call after generate. That's correct for today's single-user flow, but it silently assumes (a) the 500ms auto-save debounce always flushes before navigation, and (b) the server never mutates playlist fields the client cares about out-of-band. If either assumption breaks later (multi-device edit, generate mutation returning modified ratios), the editor will show stale data.
**Suggested approach:** Leave as-is, but add a short comment at the `useEffect` explaining the assumption so future-you doesn't "fix" it back. Separately, consider a `beforeunload` guard if `generateMutation.isPending` or the auto-save is mid-flight.

### ⬜ Harden `bearer_token` header parsing

**From:** PR #5 — Switch to Bearer token auth (mobile Safari fix)
**Area:** `api/app/controllers/application_controller.rb`
**Why:** Minor. `bearer_token` uses `header.split(" ", 2).last`, which is fine but `header.delete_prefix("Bearer ")` after the guard is more idiomatic, and there's no spec for a garbage `Authorization` header without a `Bearer ` prefix.
**Suggested approach:** Rename for clarity, add one spec in `spec/requests/api/users_spec.rb` asserting 401 for `Authorization: Basic foo` and for `Authorization: Bearer` (empty token).

### ⬜ Validate `FRONTEND_URL` before appending `#auth_token=`

**From:** PR #5 — Switch to Bearer token auth (mobile Safari fix)
**Area:** `api/app/controllers/auth_controller.rb#callback`
**Why:** The callback builds `"#{frontend_url}#auth_token=#{token}"`. If `FRONTEND_URL` ever contains a `#` (unlikely, but not impossible), the redirect produces `foo##auth_token=…` and the frontend can't parse it. Low risk; cheap guard.
**Suggested approach:** Either `URI(frontend_url).tap { |u| u.fragment = "auth_token=#{token}" }.to_s`, or assert during app boot that `FRONTEND_URL` does not contain `#`.

### ⬜ Extend "Open in Spotify" fallback to non-Premium desktop users

**From:** Mobile UX pass — PlayerBar hidden on mobile + tap-to-popover
**Area:** `api/app/services/` (OAuth user upsert), `api/app/serializers/` (or wherever the user is serialized), `client/src/context/AuthContext.tsx`, `client/src/components/layout/AppLayout.tsx`, `client/src/components/playlist/TrackItem.tsx`
**Why:** Spotify Web Playback SDK requires Premium. Free/Open users load the SDK but every `play` call 403s, so on desktop they currently tap a track, nothing happens, and the bottom `PlayerBar` sits at "No track playing" forever. The mobile pass already built the correct fallback UI (hidden PlayerBar + "Open in Spotify" popover) — we should reuse it for non-Premium desktop users so there's a single dead-end-free code path.
**Suggested approach:**
1. Backend (TDD): add a `spotify_product` string column to `users`, populate it from the Spotify `/me` response at OAuth callback time, expose it on the user serializer. Default to `nil` for existing rows (treat `nil` as "assume premium" to avoid silently breaking current users until they re-auth).
2. Frontend: expose `user.spotifyProduct` through `AuthContext`, derive `const isPremium = user?.spotifyProduct === 'premium'`. Replace the pure-CSS `md:`-based gating in `AppLayout`/`TrackItem` with `isMobile || !isPremium` — note this means the mobile/desktop split can no longer be pure Tailwind breakpoints; you'll need `useMediaQuery` or a JS breakpoint check so non-Premium desktop renders the mobile variant unconditionally.
3. Optional: one-time dismissible banner on the playlist editor for non-Premium users explaining "Playback requires Spotify Premium — tap any track to open it in Spotify."
4. Regression check: confirm Premium desktop still plays in-browser and Premium mobile still gets the popover fallback.

### ⬜ Hoist `MoveTrackModal` to a single instance in `PlaylistEditor`

**From:** PR #6 — Fix mobile UX in playlist editor
**Area:** `client/src/components/playlist/PlaylistEditor.tsx`, `client/src/components/playlist/TrackItem.tsx`, `client/src/components/playlist/MoveTrackModal.tsx`
**Why:** `MoveTrackModal` is currently rendered inside every `TrackItem`, so a 125-track playlist mounts 125 modals that all early-return `null`. It works, but you pay reconciliation + `useState`/`useEffect` setup per row, and every re-render of a row re-runs the modal's hooks. One instance at the editor level is cheaper and makes focus/aria work (below) easier to wire up.
**Suggested approach:** Lift `isMoveModalOpen` into `PlaylistEditor` as `{ trackId, index } | null`. Pass an `onOpenMoveModal(trackId, index)` callback down to `TrackItem` alongside the existing `onMove`. Render one `<MoveTrackModal />` at the editor level, reading `trackName` / `currentIndex` / `totalTracks` from the `tracks` array using the stored `trackId`.

### ⬜ Add a11y attributes + focus handling to `MoveTrackModal`

**From:** PR #6 — Fix mobile UX in playlist editor
**Area:** `client/src/components/playlist/MoveTrackModal.tsx`
**Why:** The modal is missing `role="dialog"`, `aria-modal="true"`, and an `aria-labelledby` pointing at the "Move track" heading — screen readers won't announce it as a dialog. It also doesn't autofocus the numeric input on open or return focus to the triggering Move button on close, so keyboard users lose their place. Body scroll under the modal isn't locked either, which lets the playlist scroll behind the backdrop on iOS.
**Suggested approach:** Add the three aria attributes to the inner container, autofocus the `<input>` in the existing `isOpen` effect, stash `document.activeElement` on open and `.focus()` it on close, and toggle `document.body.style.overflow = 'hidden'` for the lifetime of the open state. Keep the existing Escape/backdrop-click behavior.

### ⬜ Extract a shared `TrackRowContent` sub-component in `TrackItem`

**From:** PR #6 — Fix mobile UX in playlist editor
**Area:** `client/src/components/playlist/TrackItem.tsx`
**Why:** The desktop and mobile branches duplicate the album-art + title/artist block verbatim (`TrackItem.tsx:114–160`). Any future change to that layout has to be made in two places and it's easy to drift. The only meaningful difference between the two branches is the click handler and the trailing play-icon overlay.
**Suggested approach:** Pull the art + text block into a small local component (or just an inline render helper inside `TrackItem`) and render it once, with the desktop/mobile wrappers only differing in their `onClick` and trailing children. Don't add a new file for it.

### ⬜ Document the popover listener race + magic height constant

**From:** PR #6 — Fix mobile UX in playlist editor
**Area:** `client/src/components/playlist/TrackItem.tsx`
**Why:** Two subtle things will trip up the next reader. (1) The outside-click `useEffect` attaches `mousedown`/`touchstart` *after* the popover opens, which is only safe because the synthetic click that opened it has already dispatched — a comment would save a future debugging session. (2) `ESTIMATED_POPOVER_HEIGHT = 60` is an unexplained magic number used to choose top vs. bottom placement; if the popover ever wraps to two lines the flip logic silently lies.
**Suggested approach:** Add a one-line comment above the `useEffect` explaining the ordering, and a one-line comment next to `ESTIMATED_POPOVER_HEIGHT` noting it assumes a single-line popover. If the popover content ever grows, measure the actual rendered height via a ref instead.

---

## Done

_(nothing yet — move items here with a ✅ and a one-line note when you close them)_

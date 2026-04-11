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

---

## Done

_(nothing yet — move items here with a ✅ and a one-line note when you close them)_

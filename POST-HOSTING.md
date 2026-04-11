# Post-Hosting Security & Hardening Checklist

Things to address after the initial Render deployment. Ordered by priority.

**Status legend:** ✅ Done · ⏳ In progress · ⬜ Not started

---

## Must-have before sharing the URL publicly

### ✅ 1. Rate limiting — DONE

`rack-attack` is configured with these throttles in `/api/config/initializers/rack_attack.rb`:

- General: 100 requests per minute per IP
- Generate: 5 requests per minute per IP on `/api/playlists/:id/generate`
- Search: 30 requests per minute per IP on `/api/search`
- Auth callback: 10 requests per 5 minutes per IP

Throttled requests return a 429 JSON response. Disabled in the test environment to avoid bleeding counters across specs. Specs live at `/api/spec/requests/rate_limiting_spec.rb`.

### ⬜ 2. Token exposure

Two places tokens live in the browser now:

1. **App auth token** (JWT) — stored in `localStorage` as `auth_token` and sent via `Authorization: Bearer` header on every API request. This is our own session token, not a Spotify token. Signed with `SECRET_KEY_BASE`, 30-day expiry.
2. **Spotify access token** — returned from `/api/token` for the Web Playback SDK. Necessary for the SDK to stream audio but means the token is visible in:

- Browser network tab
- Browser memory / JS heap

Not a huge deal because:
- The token only has the scopes we granted
- It's short-lived (1 hour)
- The refresh token stays server-side

Mitigations to consider:
- Narrow the scopes (e.g., drop `playlist-modify-*` from the token returned to the browser — the backend can use a separate elevated token for publishing)
- Audit what the frontend actually needs vs what the backend needs

### ✅ 3. Email allowlist — DONE

The app supports an `ALLOWED_EMAILS` env var (comma-separated list). Implemented in `/api/app/controllers/auth_controller.rb`:

- Blank/missing env var → all authenticated Spotify users allowed (dev default)
- Set → only listed emails can log in. Unauthorized users are redirected to `${FRONTEND_URL}?error=unauthorized` and no user record is created
- Case-insensitive, whitespace-tolerant matching

Frontend (`/client/src/components/auth/LoginPage.tsx`) displays an "Your account is not authorized" banner when the error param is present.

Set `ALLOWED_EMAILS` in the Render dashboard on the `birthday-playlist-api` service to enable the gate in production.

Note: Spotify itself imposes a 25-user cap on development-mode apps, so all users must also be added as test users in the Spotify Developer Dashboard.

---

## Nice to have

### ⬜ 4. Logging & monitoring

- Render has basic stdout logs but no error aggregation
- **Sentry** has a free tier for error tracking — wire it up in both Rails and React
- Spotify API quota monitoring — log 429 rate limit responses from Spotify so we know when we're getting throttled

### ✅ 5. CSRF protection — not applicable (token auth)

App auth now uses Bearer tokens from localStorage instead of cookies, so CSRF is no longer a concern for the API. CSRF requires a cookie being automatically attached to a forged cross-site request — since we don't rely on cookies for API auth, there's nothing for an attacker's page to leverage.

The OAuth state parameter handles CSRF for the Spotify login round-trip separately.

### ⏳ 6. Input validation audit

Progress:
- ✅ **SQL injection** — Rails ActiveRecord handles this automatically
- ✅ **XSS** — React auto-escapes by default
- ✅ **Large payloads** — `PlaylistsController#update` now rejects > 500 tracks with a 413
- ⬜ **Name/text field length** — no max length on playlist names, nostalgic artist names, etc. Add model validations.
- ⬜ **Email/birth_year format** — validate server-side, not just trust the frontend

### ✅ 7. Dependency scanning — DONE

Dependabot is configured in `/.github/dependabot.yml` with weekly updates for:
- `bundler` in `/api`
- `npm` in `/client`
- `github-actions` in `/`

To enable alerts in GitHub: Repo Settings → Security → Code security and analysis → enable "Dependency graph" and "Dependabot alerts."

Also consider adding to CI:
- `bundle audit` / `brakeman` for Rails
- `npm audit` for client

---

## Lower priority

### ⬜ 8. Content Security Policy headers

Locks down what scripts/resources can run in the browser. Rails has a CSP helper:

```ruby
# config/initializers/content_security_policy.rb
Rails.application.config.content_security_policy do |policy|
  policy.default_src :self
  policy.script_src :self, "https://sdk.scdn.co"
  policy.connect_src :self, "https://api.spotify.com", "https://accounts.spotify.com"
  policy.img_src :self, "https:", "data:"
end
```

### ⬜ 9. Database backups

Render's free Postgres tier does NOT include automated backups. Options:

- Upgrade to paid ($7/mo) for daily backups with 7-day retention
- Manually dump with `pg_dump` on a cron
- Use GitHub Actions to run nightly backups to S3

### ⬜ 10. Secrets rotation

If `LOCKBOX_MASTER_KEY` or `RAILS_MASTER_KEY` ever leaks, you need a rotation plan:

- **Lockbox** supports key rotation via `previous_versions` — rotate the key, then re-encrypt existing records
- **Rails master key** rotation requires regenerating `config/credentials.yml.enc` with the new key
- For now, just don't paste these anywhere public and don't commit them to git

### ⬜ 11. HTTPS / HSTS

Render provides HTTPS automatically and `config.force_ssl = true` is set in production, which enables HSTS. Verify headers in the response after deployment:

```bash
curl -I https://birthday-playlist-api.onrender.com
# Look for: Strict-Transport-Security: max-age=...
```

### ⬜ 12. CORS origin lock

CORS is currently configured to allow only `FRONTEND_URL`. Verify this is set correctly in production and not accidentally set to `*` or a wildcard.

---

## Recommended first-pass

Before sharing the URL with anyone:

1. ✅ Add rate limiting (`rack-attack`) — **#1**
2. ✅ Decide on registration strategy — **#3** (allowlist implemented)
3. ✅ Enable Dependabot — **#7**
4. ✅ Add max payload size to `/api/playlists/:id` update — **#6** (partial)

**First-pass complete.** Remaining items are nice-to-have and can come later as the app gets real use.

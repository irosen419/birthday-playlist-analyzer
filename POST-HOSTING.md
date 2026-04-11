# Post-Hosting Security & Hardening Checklist

Things to address after the initial Render deployment. Ordered by priority.

---

## Must-have before sharing the URL publicly

### 1. Rate limiting

Right now anyone can hammer the API endpoints. Add the `rack-attack` gem to throttle:

- **Auth attempts** — brute force protection on `/auth/spotify/callback`
- **`/api/search` and `/api/playlists/:id/generate`** — these hit the Spotify API and could exhaust the quota if abused
- **General requests per IP** — e.g., 100 requests per minute per IP

Example implementation:

```ruby
# Gemfile
gem "rack-attack"

# config/initializers/rack_attack.rb
class Rack::Attack
  throttle("req/ip", limit: 100, period: 1.minute) { |req| req.ip }
  throttle("generate/ip", limit: 5, period: 1.minute) do |req|
    req.ip if req.path.match?(%r{/api/playlists/\d+/generate})
  end
  throttle("search/ip", limit: 30, period: 1.minute) do |req|
    req.ip if req.path == "/api/search"
  end
end
```

### 2. Token exposure in `/api/token`

The Web Playback SDK endpoint returns the raw Spotify access token to the browser. This is necessary for the SDK to stream audio but means the token is visible in:

- Browser network tab
- Browser memory / JS heap

Not a huge deal because:
- The token only has the scopes we granted
- It's short-lived (1 hour)
- The refresh token stays server-side

Mitigations to consider:
- Narrow the scopes (e.g., drop `playlist-modify-*` from the token returned to the browser — the backend can use a separate elevated token for publishing)
- Audit what the frontend actually needs vs what the backend needs

### 3. Open user registration

Anyone with a Spotify account can currently sign up. Options:

- **Allowlist** (simplest): Only specific Spotify emails can log in. Add a check in `AuthController#callback`:
  ```ruby
  ALLOWED_EMAILS = %w[you@example.com friend@example.com].freeze
  unless ALLOWED_EMAILS.include?(profile["email"])
    reset_session
    redirect_to "#{frontend_url}?error=unauthorized", allow_other_host: true
    return
  end
  ```
- **Invite codes**: Users need a code to complete signup (more complex, lets you share selectively)
- **Leave it open**: Fine if you're OK with the exposure — only concern is Spotify API quota

---

## Nice to have

### 4. Logging & monitoring

- Render has basic stdout logs but no error aggregation
- **Sentry** has a free tier for error tracking — wire it up in both Rails and React
- Spotify API quota monitoring — log 429 rate limit responses from Spotify so we know when we're getting throttled

### 5. CSRF protection

Rails API mode skips CSRF by default. With cookie-based auth we should consider adding it:

```ruby
# ApplicationController
include ActionController::RequestForgeryProtection
protect_from_forgery with: :exception
```

And add CSRF tokens to the frontend axios calls. The `rack-cors` config with `credentials: true` helps prevent cross-site abuse, but an explicit CSRF token on mutations is stronger.

### 6. Input validation audit

We trust the frontend to send valid data. Things to audit:

- **SQL injection** — Rails ActiveRecord handles this automatically ✓
- **XSS** — React auto-escapes by default ✓
- **Large payloads** — no max body size set. A malicious user could POST a huge `tracks` array to the auto-save endpoint and cause memory pressure. Add a limit:
  ```ruby
  # PlaylistsController#update
  return render json: { error: "Too many tracks" }, status: :payload_too_large if data[:tracks]&.length.to_i > 500
  ```
- **Name/text field length** — no max length on playlist names, nostalgic artist names, etc. Add validations.

### 7. Dependency scanning

Enable Dependabot on the GitHub repo (free):

1. Go to Repo Settings → Security → Code security and analysis
2. Enable Dependabot alerts and security updates
3. Dependabot will open PRs when dependencies have security updates

Also consider:
- `bundle audit` (already in Rails via `brakeman`) in CI
- `npm audit` in CI

---

## Lower priority

### 8. Content Security Policy headers

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

### 9. Database backups

Render's free Postgres tier does NOT include automated backups. Options:

- Upgrade to paid ($7/mo) for daily backups with 7-day retention
- Manually dump with `pg_dump` on a cron
- Use GitHub Actions to run nightly backups to S3

### 10. Secrets rotation

If `LOCKBOX_MASTER_KEY` or `RAILS_MASTER_KEY` ever leaks, you need a rotation plan:

- **Lockbox** supports key rotation via `previous_versions` — rotate the key, then re-encrypt existing records
- **Rails master key** rotation requires regenerating `config/credentials.yml.enc` with the new key
- For now, just don't paste these anywhere public and don't commit them to git

### 11. HTTPS / HSTS

Render provides HTTPS automatically and `config.force_ssl = true` is set in production, which enables HSTS. Verify headers in the response after deployment:

```bash
curl -I https://birthday-playlist-api.onrender.com
# Look for: Strict-Transport-Security: max-age=...
```

### 12. CORS origin lock

CORS is currently configured to allow only `FRONTEND_URL`. Verify this is set correctly in production and not accidentally set to `*` or a wildcard.

---

## Recommended first-pass

Before sharing the URL with anyone:

1. ✅ Add rate limiting (`rack-attack`) — **#1**
2. ✅ Decide on registration strategy — **#3**
3. ✅ Enable Dependabot — **#7**
4. ✅ Add max payload size to `/api/playlists/:id` update — **#6**

The rest can come later as the app gets real use.

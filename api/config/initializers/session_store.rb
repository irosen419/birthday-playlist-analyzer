Rails.application.config.session_store :cookie_store,
  key: "_birthday_playlist_session",
  same_site: :lax,
  secure: Rails.env.production?

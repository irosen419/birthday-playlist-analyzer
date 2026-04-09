Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  get  "auth/spotify",          to: "auth#spotify"
  get  "auth/spotify/callback", to: "auth#callback"
  delete "auth/logout",         to: "auth#logout"

  namespace :api do
    get "me", to: "users#me"
    patch "me", to: "users#update"
    get "token", to: "users#token"

    resources :nostalgic_artists, only: [:index, :create, :destroy]

    get "analysis", to: "analysis#show"

    resources :playlists, only: [:index, :show, :create, :update, :destroy] do
      member do
        post :generate
        post :publish
      end
    end

    get "search", to: "search#index"

    post "player/play",     to: "player#play"
    post "player/pause",    to: "player#pause"
    post "player/next",     to: "player#next"
    post "player/previous", to: "player#previous"
  end
end

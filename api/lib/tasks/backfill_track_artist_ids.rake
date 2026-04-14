namespace :backfill do
  desc "Backfill Spotify artist IDs onto tracks.artist_names (idempotent)"
  task track_artist_ids: :environment do
    BATCH_SIZE = 50
    SLEEP_BETWEEN_BATCHES = 2

    user = User.where.not(access_token: nil).order(:id).first
    abort "No user with a Spotify access token; run after at least one user has logged in." unless user

    client = SpotifyApiClient.new(user)

    # Rows needing backfill: any entry in artist_names is still a plain string,
    # or is an object with a nil/blank id.
    scope = Track.where(<<~SQL)
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(tracks.artist_names) AS elem
        WHERE jsonb_typeof(elem) = 'string'
           OR (elem->>'id') IS NULL
           OR (elem->>'id') = ''
      )
    SQL

    total = scope.count
    puts "Backfilling #{total} track(s)."
    done = 0

    scope.find_in_batches(batch_size: BATCH_SIZE) do |batch|
      spotify_ids = batch.map(&:spotify_id)
      response = client.tracks_by_ids(ids: spotify_ids)
      payloads = (response["tracks"] || []).compact.index_by { |t| t["id"] }

      Track.transaction do
        batch.each do |track|
          payload = payloads[track.spotify_id]
          unless payload
            puts "  - skipped #{track.spotify_id} (no Spotify payload)"
            next
          end

          new_shape = (payload["artists"] || []).map do |a|
            { "id" => a["id"], "name" => a["name"] }
          end
          track.update_columns(artist_names: new_shape) if new_shape.present?
        end
      end

      done += batch.size
      puts "  …#{done}/#{total}"
      sleep SLEEP_BETWEEN_BATCHES if done < total
    end

    puts "Done."
  end
end

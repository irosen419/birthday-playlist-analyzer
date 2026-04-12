module Api
  class PlaylistsController < ApplicationController
    MAX_TRACKS_PER_UPDATE = 500

    wrap_parameters false
    before_action :authenticate_user!
    before_action :set_playlist, only: [:show, :update, :destroy, :generate, :publish]

    def index
      playlists = current_user.playlists
        .includes(:playlist_tracks)
        .joins(:playlist_tracks)
        .distinct
        .order(created_at: :asc)

      render json: playlists.map { |p| playlist_summary(p) }
    end

    def show
      render json: playlist_detail(@playlist)
    end

    def create
      playlist = current_user.playlists.build(create_params)

      if playlist.save
        render json: playlist.as_json, status: :created
      else
        render json: { errors: playlist.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def update
      data = params[:playlist].present? ? params[:playlist] : params

      if data[:tracks]&.length.to_i > MAX_TRACKS_PER_UPDATE
        return render json: { error: "Too many tracks (max #{MAX_TRACKS_PER_UPDATE})" },
                      status: :payload_too_large
      end

      ActiveRecord::Base.transaction do
        attrs = {}
        attrs[:name] = data[:name] if data[:name].present?
        attrs[:birth_year] = data[:birth_year] if data.key?(:birth_year)
        attrs[:favorites_ratio] = data[:favorites_ratio].to_f if data.key?(:favorites_ratio)
        attrs[:discovery_ratio] = data[:discovery_ratio].to_f if data.key?(:discovery_ratio)
        attrs[:era_hits_ratio] = data[:era_hits_ratio].to_f if data.key?(:era_hits_ratio)
        attrs[:target_song_count] = data[:target_song_count].to_i if data.key?(:target_song_count)
        @playlist.update!(attrs) if attrs.any?
        replace_tracks(data[:tracks]) if data[:tracks].present?
      end

      render json: playlist_detail(@playlist.reload)
    end

    def destroy
      @playlist.destroy!
      head :no_content
    end

    def generate
      birth_year = params[:birth_year]&.to_i || @playlist.effective_birth_year
      locked_track_ids = Array(params[:locked_track_ids])
      config = @playlist.generation_config

      ratio_sum = config[:favorites_ratio] + config[:discovery_ratio] + config[:era_hits_ratio]
      unless (ratio_sum - 1.0).abs <= 0.02
        return render json: { error: "Ratios must sum to 100% (currently #{(ratio_sum * 100).round(0)}%)" }, status: :unprocessable_entity
      end
      target_count = config[:target_song_count] - locked_track_ids.length

      analyzer = TopItemsAnalyzer.new(spotify_client)
      analysis = analyzer.analyze

      generator = PlaylistGeneratorService.new(current_user, spotify_client)
      result = generator.generate(
        analysis[:analysis],
        birth_year: birth_year,
        target_count: target_count,
        exclude_track_ids: locked_track_ids,
        favorites_ratio: config[:favorites_ratio],
        discovery_ratio: config[:discovery_ratio],
        era_hits_ratio: config[:era_hits_ratio]
      )

      ActiveRecord::Base.transaction do
        persist_generated_tracks(result[:tracks] || [], locked_track_ids)
      end

      render json: playlist_detail(@playlist.reload)
    rescue ActiveRecord::ActiveRecordError => e
      Rails.logger.error("[generate] persistence failed: #{e.class}: #{e.message}\n#{e.backtrace.first(10).join("\n")}")
      render json: { error: "Failed to persist generated playlist: #{e.message}" }, status: :internal_server_error
    end

    def publish
      track_uris = @playlist.playlist_tracks.includes(:track).order(:position).map { |pt| pt.track.uri }

      if @playlist.spotify_playlist_id.present?
        republish_playlist(track_uris)
      else
        create_spotify_playlist(track_uris)
      end

      @playlist.update!(published_at: Time.current)

      render json: {
        id: @playlist.id,
        name: @playlist.name,
        url: spotify_playlist_url
      }
    end

    private

    def set_playlist
      @playlist = current_user.playlists.find_by(id: params[:id])
      render json: { error: "Not found" }, status: :not_found unless @playlist
    end

    def create_params
      permitted = [:name, :birth_year, :favorites_ratio, :discovery_ratio, :era_hits_ratio, :target_song_count]
      if params[:playlist].present?
        params.require(:playlist).permit(*permitted)
      else
        params.permit(*permitted)
      end
    end

    def playlist_summary(playlist)
      playlist.as_json(only: SERIALIZABLE_FIELDS)
        .merge("track_count" => playlist.playlist_tracks.size)
    end

    SERIALIZABLE_FIELDS = [
      :id, :name, :description, :birth_year, :spotify_playlist_id, :published_at,
      :favorites_ratio, :discovery_ratio, :era_hits_ratio, :target_song_count,
      :created_at, :updated_at
    ].freeze

    def playlist_detail(playlist)
      tracks = playlist.playlist_tracks.includes(:track).order(:position).map do |pt|
        track = pt.track
        {
          "id" => track.spotify_id,
          "spotify_id" => track.spotify_id,
          "name" => track.name,
          "artists" => (track.artist_names || []).map { |name| { "id" => "", "name" => name } },
          "album" => {
            "name" => track.album_name,
            "images" => track.album_art_url.present? ? [{ "url" => track.album_art_url }] : []
          },
          "duration_ms" => track.duration_ms,
          "popularity" => track.popularity,
          "preview_url" => track.preview_url,
          "uri" => track.uri,
          "position" => pt.position,
          "locked" => pt.locked,
          "source" => pt.source
        }
      end

      playlist.as_json(only: SERIALIZABLE_FIELDS)
        .merge("tracks" => tracks)
    end

    def persist_generated_tracks(generated_tracks, locked_spotify_ids)
      locked_set = locked_spotify_ids.to_set
      locked_pts = @playlist.playlist_tracks.includes(:track).select { |pt| locked_set.include?(pt.track.spotify_id) }
      locked_by_position = locked_pts.index_by(&:position)

      seen_ids = locked_pts.map { |pt| pt.track.spotify_id }.to_set
      deduped = generated_tracks.each_with_object([]) do |t, acc|
        id = t["id"] || t[:id]
        next if id.blank? || seen_ids.include?(id)
        seen_ids << id
        acc << t
      end

      @playlist.playlist_tracks.where.not(id: locked_pts.map(&:id)).destroy_all

      total = locked_pts.size + deduped.size
      new_idx = 0
      (0...total).each do |pos|
        if locked_by_position[pos]
          locked_by_position[pos].update!(position: pos)
          next
        end

        track_data = deduped[new_idx]
        new_idx += 1
        next unless track_data

        track = Track.upsert_from_spotify(generator_track_to_symbols(track_data))
        @playlist.playlist_tracks.create!(
          track: track,
          position: pos,
          locked: false,
          source: normalize_source(track_data["source"])
        )
      end
    end

    def generator_track_to_symbols(data)
      {
        id: data["id"],
        name: data["name"],
        artists: (data["artists"] || []).map { |a| { name: a["name"] } },
        album: {
          name: data.dig("album", "name"),
          images: data.dig("album", "images") || []
        }.transform_values { |v| v.is_a?(Array) ? v.map { |img| { url: img["url"] } } : v },
        duration_ms: data["duration_ms"],
        popularity: data["popularity"],
        preview_url: data["preview_url"],
        uri: data["uri"]
      }
    end

    def normalize_source(source)
      valid = PlaylistTrack.sources.keys
      valid.include?(source) ? source : "favorite"
    end

    def replace_tracks(tracks_data)
      @playlist.playlist_tracks.delete_all

      tracks_data.each do |track_data|
        track = Track.upsert_from_spotify(normalize_track_data(track_data))

        @playlist.playlist_tracks.create!(
          track: track,
          position: track_data[:position],
          locked: track_data[:locked] || false,
          source: track_data[:source] || "favorite"
        )
      end
    end

    def normalize_track_data(data)
      {
        id: data[:spotify_id],
        name: data[:name],
        artists: data[:artists]&.map { |a| { name: a[:name] } },
        album: {
          name: data.dig(:album, :name),
          images: data.dig(:album, :images) || []
        },
        duration_ms: data[:duration_ms],
        popularity: data[:popularity],
        preview_url: data[:preview_url],
        uri: data[:uri]
      }
    end

    def create_spotify_playlist(track_uris)
      result = spotify_client.create_playlist(name: @playlist.name)
      @playlist.update!(spotify_playlist_id: result["id"])
      spotify_client.add_tracks_to_playlist(playlist_id: result["id"], track_uris: track_uris)
      @spotify_external_url = result.dig("external_urls", "spotify")
    end

    def republish_playlist(track_uris)
      spotify_client.replace_playlist_tracks(playlist_id: @playlist.spotify_playlist_id, track_uris: [])
      spotify_client.add_tracks_to_playlist(playlist_id: @playlist.spotify_playlist_id, track_uris: track_uris)
    end

    def spotify_playlist_url
      @spotify_external_url || "https://open.spotify.com/playlist/#{@playlist.spotify_playlist_id}"
    end
  end
end

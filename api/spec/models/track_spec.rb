require 'rails_helper'

RSpec.describe Track, type: :model do
  describe 'associations' do
    it { is_expected.to have_many(:playlist_tracks).dependent(:destroy) }
  end

  describe 'validations' do
    subject { build(:track) }

    it { is_expected.to validate_presence_of(:spotify_id) }
    it { is_expected.to validate_uniqueness_of(:spotify_id) }
    it { is_expected.to validate_presence_of(:name) }
  end

  describe '.upsert_from_spotify' do
    let(:spotify_data) do
      {
        id: 'spotify_track_123',
        name: 'Bye Bye Bye',
        artists: [{ id: 'artist1', name: 'NSYNC' }],
        album: { name: 'No Strings Attached', images: [{ url: 'https://example.com/album.jpg' }] },
        duration_ms: 200_000,
        popularity: 75,
        preview_url: 'https://example.com/preview.mp3',
        uri: 'spotify:track:123'
      }
    end

    it 'creates a new track from spotify data' do
      track = Track.upsert_from_spotify(spotify_data)

      expect(track).to be_persisted
      expect(track.spotify_id).to eq('spotify_track_123')
      expect(track.name).to eq('Bye Bye Bye')
      expect(track.artist_names).to eq([{ 'id' => 'artist1', 'name' => 'NSYNC' }])
      expect(track.album_name).to eq('No Strings Attached')
      expect(track.album_art_url).to eq('https://example.com/album.jpg')
      expect(track.duration_ms).to eq(200_000)
      expect(track.popularity).to eq(75)
      expect(track.preview_url).to eq('https://example.com/preview.mp3')
      expect(track.uri).to eq('spotify:track:123')
    end

    it 'updates an existing track with new metadata' do
      existing = create(:track, spotify_id: 'spotify_track_123', name: 'Old Name')

      updated = Track.upsert_from_spotify(spotify_data)

      expect(updated.id).to eq(existing.id)
      expect(updated.name).to eq('Bye Bye Bye')
    end

    it 'handles multiple artists' do
      data = spotify_data.merge(artists: [{ id: 'a1', name: 'Artist One' }, { id: 'a2', name: 'Artist Two' }])

      track = Track.upsert_from_spotify(data)

      expect(track.artist_names).to eq([
        { 'id' => 'a1', 'name' => 'Artist One' },
        { 'id' => 'a2', 'name' => 'Artist Two' }
      ])
    end

    it 'handles missing album images gracefully' do
      data = spotify_data.merge(album: { name: 'Album', images: [] })

      track = Track.upsert_from_spotify(data)

      expect(track.album_art_url).to be_nil
    end
  end
end

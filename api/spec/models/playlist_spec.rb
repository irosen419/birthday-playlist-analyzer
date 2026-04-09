require 'rails_helper'

RSpec.describe Playlist, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to have_many(:playlist_tracks).dependent(:destroy) }
    it { is_expected.to have_many(:tracks).through(:playlist_tracks) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:name) }
  end

  describe '#effective_birth_year' do
    it 'returns the playlist birth_year when set' do
      playlist = build(:playlist, birth_year: 1985)

      expect(playlist.effective_birth_year).to eq(1985)
    end

    it 'falls back to user birth_year when playlist birth_year is nil' do
      user = build(:user, birth_year: 1993)
      playlist = build(:playlist, user: user, birth_year: nil)

      expect(playlist.effective_birth_year).to eq(1993)
    end
  end

  describe '#published?' do
    it 'returns true when spotify_playlist_id is present' do
      playlist = build(:playlist, spotify_playlist_id: 'abc123')

      expect(playlist.published?).to be true
    end

    it 'returns false when spotify_playlist_id is nil' do
      playlist = build(:playlist, spotify_playlist_id: nil)

      expect(playlist.published?).to be false
    end
  end

  describe 'playlist_tracks ordering' do
    it 'orders playlist_tracks by position' do
      playlist = create(:playlist)
      track_a = create(:track, spotify_id: 'a')
      track_b = create(:track, spotify_id: 'b')

      create(:playlist_track, playlist: playlist, track: track_b, position: 2)
      create(:playlist_track, playlist: playlist, track: track_a, position: 1)

      expect(playlist.playlist_tracks.map(&:position)).to eq([1, 2])
    end
  end
end

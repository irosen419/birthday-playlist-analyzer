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

  describe 'default name' do
    it 'assigns "Playlist 1" for a user\'s first playlist when name is blank' do
      user = create(:user)
      playlist = user.playlists.create!(name: '')

      expect(playlist.name).to eq('Playlist 1')
    end

    it 'increments per user, ignoring other users' do
      user = create(:user)
      other = create(:user)
      other.playlists.create!(name: '')
      user.playlists.create!(name: '')

      playlist = user.playlists.create!(name: '')

      expect(playlist.name).to eq('Playlist 2')
    end

    it 'picks the next number after the highest existing "Playlist N" name' do
      user = create(:user)
      user.playlists.create!(name: 'Playlist 5')
      user.playlists.create!(name: 'My Mix')

      playlist = user.playlists.create!(name: '')

      expect(playlist.name).to eq('Playlist 6')
    end

    it 'leaves explicit names untouched' do
      user = create(:user)
      playlist = user.playlists.create!(name: 'Birthday Party Playlist')

      expect(playlist.name).to eq('Birthday Party Playlist')
    end
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

  describe '#generation_config' do
    it 'returns a hash of generation configuration values' do
      playlist = build(:playlist, favorites_ratio: 0.4, discovery_ratio: 0.3, era_hits_ratio: 0.3, target_song_count: 100)

      config = playlist.generation_config

      expect(config).to eq({
        favorites_ratio: 0.4,
        discovery_ratio: 0.3,
        era_hits_ratio: 0.3,
        target_song_count: 100
      })
    end

    it 'uses default values when not explicitly set' do
      playlist = build(:playlist)

      config = playlist.generation_config

      expect(config[:favorites_ratio]).to eq(0.3)
      expect(config[:discovery_ratio]).to eq(0.3)
      expect(config[:era_hits_ratio]).to eq(0.4)
      expect(config[:target_song_count]).to eq(125)
    end
  end

  describe 'ratio validations' do
    it 'is valid when ratios sum to 1.0' do
      playlist = build(:playlist, favorites_ratio: 0.3, discovery_ratio: 0.3, era_hits_ratio: 0.4)

      expect(playlist).to be_valid
    end

    it 'is valid with floating point tolerance' do
      playlist = build(:playlist, favorites_ratio: 0.33, discovery_ratio: 0.33, era_hits_ratio: 0.34)

      expect(playlist).to be_valid
    end

    it 'allows ratios that do not sum to 1.0 (validation happens on generate, not save)' do
      playlist = build(:playlist, favorites_ratio: 0.5, discovery_ratio: 0.5, era_hits_ratio: 0.5)

      expect(playlist).to be_valid
    end

    it 'rejects target_song_count below 30' do
      playlist = build(:playlist, target_song_count: 29)

      expect(playlist).not_to be_valid
    end

    it 'accepts target_song_count at the lower bound of 30' do
      playlist = build(:playlist, target_song_count: 30)

      expect(playlist).to be_valid
    end

    it 'accepts target_song_count within valid range' do
      playlist = build(:playlist, target_song_count: 150)

      expect(playlist).to be_valid
    end

    it 'accepts target_song_count at the upper bound of 200' do
      playlist = build(:playlist, target_song_count: 200)

      expect(playlist).to be_valid
    end

    it 'rejects target_song_count above 200' do
      playlist = build(:playlist, target_song_count: 201)

      expect(playlist).not_to be_valid
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

require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'associations' do
    it { is_expected.to have_many(:playlists).dependent(:destroy) }
    it { is_expected.to have_many(:nostalgic_artists).dependent(:destroy) }
  end

  describe 'validations' do
    subject { build(:user) }

    it { is_expected.to validate_presence_of(:spotify_id) }
    it { is_expected.to validate_uniqueness_of(:spotify_id) }
  end

  describe 'encrypted attributes' do
    it 'encrypts access_token' do
      user = create(:user, access_token: 'secret-access-token')
      user.reload

      expect(user.access_token).to eq('secret-access-token')
      expect(user.access_token_ciphertext).not_to eq('secret-access-token')
    end

    it 'encrypts refresh_token' do
      user = create(:user, refresh_token: 'secret-refresh-token')
      user.reload

      expect(user.refresh_token).to eq('secret-refresh-token')
      expect(user.refresh_token_ciphertext).not_to eq('secret-refresh-token')
    end
  end

  describe '#token_expired?' do
    it 'returns true when token_expires_at is in the past' do
      user = build(:user, token_expires_at: 1.minute.ago)

      expect(user.token_expired?).to be true
    end

    it 'returns false when token_expires_at is in the future' do
      user = build(:user, token_expires_at: 1.hour.from_now)

      expect(user.token_expired?).to be false
    end
  end

  describe '#seed_default_nostalgic_artists' do
    it 'creates default nostalgic artists after user creation' do
      user = create(:user)

      expect(user.nostalgic_artists.count).to eq(5)

      expected_names = ['NSYNC', 'Backstreet Boys', 'Smash Mouth', 'Britney Spears', 'Christina Aguilera']
      actual_names = user.nostalgic_artists.pluck(:name).sort
      expect(actual_names).to eq(expected_names.sort)

      user.nostalgic_artists.each do |artist|
        expect(artist.era).to eq('formative')
      end
    end

    it 'does not duplicate artists when called again' do
      user = create(:user)

      expect { user.send(:seed_default_nostalgic_artists) }.not_to change { user.nostalgic_artists.count }
    end
  end
end

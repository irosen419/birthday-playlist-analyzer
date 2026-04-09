require 'rails_helper'

RSpec.describe PlaylistTrack, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:playlist) }
    it { is_expected.to belong_to(:track) }
  end

  describe 'validations' do
    subject { create(:playlist_track) }

    it { is_expected.to validate_presence_of(:position) }
    it { is_expected.to validate_uniqueness_of(:position).scoped_to(:playlist_id) }
  end

  describe 'source enum' do
    it { is_expected.to define_enum_for(:source).with_values(favorite: 0, genre_discovery: 1, era_hit: 2, manual: 3) }
  end
end

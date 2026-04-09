require 'rails_helper'

RSpec.describe NostalgicArtist, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:user) }
  end

  describe 'validations' do
    subject { build(:nostalgic_artist) }

    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:era) }

    it do
      is_expected.to validate_inclusion_of(:era)
        .in_array(%w[formative high_school college])
    end

    it { is_expected.to validate_uniqueness_of(:name).scoped_to(:user_id, :era) }
  end
end

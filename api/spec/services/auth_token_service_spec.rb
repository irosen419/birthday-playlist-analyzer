require "rails_helper"

RSpec.describe AuthTokenService do
  let(:user_id) { 42 }

  describe ".encode" do
    it "returns a string" do
      token = described_class.encode(user_id)

      expect(token).to be_a(String)
      expect(token).not_to be_empty
    end
  end

  describe ".decode" do
    it "returns the user_id when given a valid token" do
      token = described_class.encode(user_id)

      expect(described_class.decode(token)).to eq(user_id)
    end

    it "returns nil for an invalid token" do
      expect(described_class.decode("not-a-real-token")).to be_nil
    end

    it "returns nil for a token signed with a different secret" do
      payload = { user_id: user_id, exp: 1.hour.from_now.to_i }
      foreign_token = JWT.encode(payload, "other-secret", "HS256")

      expect(described_class.decode(foreign_token)).to be_nil
    end

    it "returns nil for an expired token" do
      token = described_class.encode(user_id)

      travel_to(described_class::EXPIRY.from_now + 1.minute) do
        expect(described_class.decode(token)).to be_nil
      end
    end
  end

  describe "roundtrip" do
    it "decodes to the same user_id that was encoded" do
      token = described_class.encode(user_id)

      expect(described_class.decode(token)).to eq(user_id)
    end
  end
end

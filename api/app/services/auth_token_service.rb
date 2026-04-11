class AuthTokenService
  EXPIRY = 30.days

  def self.encode(user_id)
    payload = { user_id: user_id, exp: EXPIRY.from_now.to_i }
    JWT.encode(payload, secret, "HS256")
  end

  def self.decode(token)
    payload, = JWT.decode(token, secret, true, algorithm: "HS256")
    payload["user_id"]
  rescue JWT::DecodeError, JWT::ExpiredSignature
    nil
  end

  def self.secret
    Rails.application.secret_key_base
  end
end

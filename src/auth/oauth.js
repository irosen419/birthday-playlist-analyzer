import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Generates a random string for state parameter (CSRF protection).
 */
export function generateState(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generates the PKCE code verifier and challenge.
 */
export function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}

/**
 * Builds the Spotify authorization URL.
 */
export function buildAuthorizationUrl(state, codeChallenge) {
  const params = new URLSearchParams({
    client_id: config.spotify.clientId,
    response_type: 'code',
    redirect_uri: config.spotify.redirectUri,
    scope: config.scopes.join(' '),
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Exchanges the authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(code, codeVerifier) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.spotify.clientId,
      client_secret: config.spotify.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.spotify.redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

/**
 * Refreshes the access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.spotify.clientId,
      client_secret: config.spotify.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Spotify may or may not return a new refresh token
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

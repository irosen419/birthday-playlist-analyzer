import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import open from 'open';
import { config } from '../config.js';
import { generateState, generatePKCE, buildAuthorizationUrl, exchangeCodeForTokens } from './oauth.js';
import { saveTokens, loadTokens } from '../utils/token-storage.js';
import { logger } from '../utils/logger.js';
import apiRoutes, { resetClient } from '../server/api-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// Serve static files from public directory
const publicPath = join(__dirname, '../public');
app.use(express.static(publicPath));

// Mount API routes
app.use('/api', apiRoutes);

// Store state and PKCE values for verification
let authState = null;
let pkceVerifier = null;

/**
 * Home route - serves the web UI or initiates OAuth if not authenticated.
 */
app.get('/', (req, res) => {
  const tokens = loadTokens();

  if (tokens?.accessToken) {
    // Already authenticated - serve the web app
    res.sendFile(join(publicPath, 'index.html'));
  } else {
    // Not authenticated - show login page
    authState = generateState();
    const pkce = generatePKCE();
    pkceVerifier = pkce.verifier;

    const authUrl = buildAuthorizationUrl(authState, pkce.challenge);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Birthday Playlist Analyzer - Login</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #121212;
            color: #fff;
          }
          .container {
            text-align: center;
            padding: 60px 40px;
            background: #181818;
            border-radius: 16px;
            max-width: 400px;
          }
          h1 {
            font-size: 28px;
            margin-bottom: 12px;
            color: #fff;
          }
          p {
            color: #b3b3b3;
            margin-bottom: 32px;
            line-height: 1.6;
          }
          a.btn {
            display: inline-block;
            padding: 16px 48px;
            background: #1DB954;
            color: #000;
            text-decoration: none;
            border-radius: 500px;
            font-weight: 700;
            font-size: 16px;
            transition: transform 0.2s, background 0.2s;
          }
          a.btn:hover {
            background: #1ed760;
            transform: scale(1.04);
          }
          .logo {
            font-size: 48px;
            margin-bottom: 24px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">&#127881;</div>
          <h1>Birthday Playlist Analyzer</h1>
          <p>Connect your Spotify account to analyze your music taste and create the perfect party playlist!</p>
          <a href="${authUrl}" class="btn">Connect with Spotify</a>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * Login route - initiates OAuth flow.
 */
app.get('/login', (req, res) => {
  authState = generateState();
  const pkce = generatePKCE();
  pkceVerifier = pkce.verifier;

  const authUrl = buildAuthorizationUrl(authState, pkce.challenge);
  res.redirect(authUrl);
});

/**
 * OAuth callback route - handles the redirect from Spotify.
 */
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('Authorization denied:', error);
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #121212;
            color: #fff;
          }
          .container { text-align: center; padding: 40px; }
          h1 { color: #e74c3c; margin-bottom: 16px; }
          p { color: #b3b3b3; margin-bottom: 24px; }
          a { color: #1DB954; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authorization Failed</h1>
          <p>Error: ${error}</p>
          <p><a href="/">Try again</a></p>
        </div>
      </body>
      </html>
    `);
  }

  if (state !== authState) {
    logger.error('State mismatch - possible CSRF attack');
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #121212;
            color: #fff;
          }
          .container { text-align: center; padding: 40px; }
          h1 { color: #e74c3c; margin-bottom: 16px; }
          p { color: #b3b3b3; margin-bottom: 24px; }
          a { color: #1DB954; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authorization Failed</h1>
          <p>State mismatch - please try again</p>
          <p><a href="/">Try again</a></p>
        </div>
      </body>
      </html>
    `);
  }

  try {
    logger.info('Exchanging code for tokens...');
    const tokens = await exchangeCodeForTokens(code, pkceVerifier);

    saveTokens(tokens);
    resetClient();
    logger.success('Authentication successful!');

    // Redirect to the main app
    res.redirect('/');

  } catch (err) {
    logger.error('Token exchange failed:', err.message);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #121212;
            color: #fff;
          }
          .container { text-align: center; padding: 40px; }
          h1 { color: #e74c3c; margin-bottom: 16px; }
          p { color: #b3b3b3; margin-bottom: 24px; }
          a { color: #1DB954; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authentication Failed</h1>
          <p>Error: ${err.message}</p>
          <p><a href="/">Try again</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * Logout route - clears state and redirects to login.
 */
app.get('/logout', (req, res) => {
  resetClient();
  res.redirect('/login');
});

/**
 * Starts the server.
 */
function startServer() {
  const { port } = config.server;

  if (!config.spotify.clientSecret) {
    logger.error('SPOTIFY_CLIENT_SECRET is not set!');
    logger.info('Please create a .env file with your Spotify client secret.');
    logger.info('You can copy .env.example as a starting point.');
    process.exit(1);
  }

  app.listen(port, '0.0.0.0', () => {
    const url = `http://192.168.1.253:${port}`;
    logger.section('Birthday Playlist Analyzer');
    logger.info(`Server running at ${url}`);

    const tokens = loadTokens();
    if (tokens?.accessToken) {
      logger.success('Already authenticated - opening app...');
    } else {
      logger.info('Opening browser for authentication...');
    }

    open(url);
  });
}

startServer();

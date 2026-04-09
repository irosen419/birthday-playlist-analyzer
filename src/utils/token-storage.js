import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ENV_PATH = join(__dirname, '../../.env');

/**
 * Updates the .env file with new token values.
 * Creates the file from .env.example if it doesn't exist.
 */
export function saveTokens({ accessToken, refreshToken, expiresIn }) {
  let envContent = '';

  if (existsSync(ENV_PATH)) {
    envContent = readFileSync(ENV_PATH, 'utf-8');
  } else {
    const examplePath = join(__dirname, '../../.env.example');
    if (existsSync(examplePath)) {
      envContent = readFileSync(examplePath, 'utf-8');
    }
  }

  const updateEnvValue = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    }
    return `${content}\n${key}=${value}`;
  };

  envContent = updateEnvValue(envContent, 'SPOTIFY_ACCESS_TOKEN', accessToken);
  envContent = updateEnvValue(envContent, 'SPOTIFY_REFRESH_TOKEN', refreshToken);

  writeFileSync(ENV_PATH, envContent);

  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  console.log(`Tokens saved to .env file`);
  console.log(`Access token expires at: ${expiresAt.toLocaleString()}`);
}

/**
 * Reads tokens from the .env file.
 */
export function loadTokens() {
  if (!existsSync(ENV_PATH)) {
    return null;
  }

  const envContent = readFileSync(ENV_PATH, 'utf-8');
  const accessToken = envContent.match(/^SPOTIFY_ACCESS_TOKEN=(.*)$/m)?.[1];
  const refreshToken = envContent.match(/^SPOTIFY_REFRESH_TOKEN=(.*)$/m)?.[1];

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

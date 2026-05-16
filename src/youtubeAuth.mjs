import { existsSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { google } from 'googleapis';
import { config, tokenPath } from './config.mjs';

const scopes = ['https://www.googleapis.com/auth/youtube.upload'];

export function getOAuthClient() {
  if (!config.youtube.clientId || !config.youtube.clientSecret) {
    throw new Error('YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET are required.');
  }
  return new google.auth.OAuth2(
    config.youtube.clientId,
    config.youtube.clientSecret,
    config.youtube.redirectUri,
  );
}

export async function ensureYoutubeAuth() {
  const oauth2Client = getOAuthClient();
  if (existsSync(tokenPath)) {
    const token = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(tokenPath, 'utf8')));
    oauth2Client.setCredentials(token);
    return oauth2Client;
  }
  throw new Error(`YouTube token missing. Run: npm run auth:youtube`);
}

export async function runYoutubeAuth() {
  const oauth2Client = getOAuthClient();
  const url = new URL(config.youtube.redirectUri);
  const server = http.createServer();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  console.log('\nOpen this URL and approve YouTube upload access:\n');
  console.log(authUrl);
  console.log('\nWaiting for OAuth callback...\n');

  await new Promise((resolve, reject) => {
    server.on('request', async (req, res) => {
      try {
        const reqUrl = new URL(req.url, config.youtube.redirectUri);
        const code = reqUrl.searchParams.get('code');
        if (!code) {
          res.end('Missing code.');
          return;
        }
        const { tokens } = await oauth2Client.getToken(code);
        writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
        res.end('YouTube auth complete. You can close this tab.');
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        server.close();
      }
    });
    server.listen(Number(url.port || 53682), url.hostname);
  });

  console.log(`Saved token to ${tokenPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runYoutubeAuth().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

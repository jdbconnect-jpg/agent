import { createReadStream, readFileSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { config, outDir } from './config.mjs';
import { ensureYoutubeAuth } from './youtubeAuth.mjs';

export async function uploadVideo({ videoPath = path.join(outDir, 'jepq-monthly-income.mp4') } = {}) {
  const auth = await ensureYoutubeAuth();
  const youtube = google.youtube({ version: 'v3', auth });
  const { plan } = JSON.parse(readFileSync(path.join(outDir, 'video-plan.json'), 'utf8'));

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: plan.title.slice(0, 100),
        description: `${plan.description}\n\n${plan.disclosure}`,
        tags: plan.tags,
        categoryId: config.youtube.categoryId,
      },
      status: {
        privacyStatus: config.youtube.privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: createReadStream(videoPath),
    },
  });

  return response.data;
}

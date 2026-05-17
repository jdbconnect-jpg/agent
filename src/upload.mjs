import { createReadStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { config, outDir } from './config.mjs';
import { ensureYoutubeAuth } from './youtubeAuth.mjs';

export async function uploadVideo({
  videoPath = path.join(outDir, 'jepq-monthly-income.mp4'),
  thumbnailPath = path.join(outDir, 'thumbnail.jpg'),
  planPath = path.join(outDir, 'video-plan.json'),
  title = null,
  description = null,
  tags = null,
} = {}) {
  const auth = await ensureYoutubeAuth();
  const youtube = google.youtube({ version: 'v3', auth });
  const payload = JSON.parse(readFileSync(planPath, 'utf8'));
  const plan = payload.plan || payload;
  const uploadTitle = title || plan.youtubeTitle || plan.title;
  const uploadDescription = description || plan.youtubeDescription || [plan.description, plan.disclosure].filter(Boolean).join('\n\n');
  const uploadTags = tags || plan.youtubeTags || plan.tags || [];

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: uploadTitle.slice(0, 100),
        description: uploadDescription,
        tags: uploadTags,
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

  if (thumbnailPath && existsSync(thumbnailPath)) {
    await youtube.thumbnails.set({
      videoId: response.data.id,
      media: {
        body: createReadStream(thumbnailPath),
      },
    });
  }

  return response.data;
}

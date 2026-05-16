import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config, outDir } from './config.mjs';

const stockDir = path.join(outDir, 'stock');

export async function searchCoverrCandidates({ query = config.coverr.query, limit = config.coverr.clips } = {}) {
  if (!config.coverr.apiKey) {
    console.log('COVERR_API_KEY is not set; skipping Coverr.');
    return [];
  }

  const url = new URL('https://api.coverr.co/videos');
  url.searchParams.set('query', query);
  url.searchParams.set('urls', 'true');
  url.searchParams.set('page_size', String(limit));
  url.searchParams.set('sort', 'popular');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.coverr.apiKey}` },
  });
  if (!res.ok) throw new Error(`Coverr API failed: ${res.status} ${res.statusText}`);

  const data = await res.json();
  return (data.hits || []).map((video) => {
    const sourceUrl = video.urls?.mp4 || video.urls?.mp4_preview || video.urls?.mp4_download;
    if (!sourceUrl) return null;
    return {
      id: video.id,
      provider: 'coverr',
      sourceUrl,
      width: video.max_width,
      height: video.max_height,
      duration: video.duration,
      url: `https://coverr.co/videos/${video.id}`,
      credit: 'Coverr',
      title: video.title,
    };
  }).filter(Boolean);
}

export async function downloadCoverrClips() {
  mkdirSync(stockDir, { recursive: true });
  const candidates = await searchCoverrCandidates();
  const clips = [];

  for (const [index, video] of candidates.entries()) {
    const clipPath = path.join(stockDir, `coverr-${String(index + 1).padStart(2, '0')}.mp4`);
    const clipRes = await fetch(video.sourceUrl);
    if (!clipRes.ok) continue;
    await pipeline(clipRes.body, createWriteStream(clipPath));
    clips.push({
      ...video,
      path: clipPath,
    });
  }

  writeFileSync(path.join(stockDir, 'coverr-manifest.json'), JSON.stringify(clips, null, 2));
  return clips;
}

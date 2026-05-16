import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config, outDir } from './config.mjs';

const stockDir = path.join(outDir, 'stock');

function pickVerticalFile(video) {
  const files = [...(video.video_files || [])]
    .filter((file) => file.file_type === 'video/mp4' && file.link)
    .sort((a, b) => {
      const aScore = (a.height || 0) > (a.width || 0) ? 2 : 0;
      const bScore = (b.height || 0) > (b.width || 0) ? 2 : 0;
      return (bScore + (b.height || 0) / 1000) - (aScore + (a.height || 0) / 1000);
    });
  return files[0] || null;
}

export async function searchPexelsCandidates({ query = config.pexels.query, limit = config.pexels.clips } = {}) {
  if (!config.pexels.apiKey) {
    console.log('PEXELS_API_KEY is not set; skipping stock clip download.');
    return [];
  }

  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', String(limit));

  const res = await fetch(url, {
    headers: { Authorization: config.pexels.apiKey },
  });
  if (!res.ok) throw new Error(`Pexels API failed: ${res.status} ${res.statusText}`);

  const data = await res.json();
  return (data.videos || []).map((video) => {
    const file = pickVerticalFile(video);
    if (!file) return null;
    return {
      id: video.id,
      provider: 'pexels',
      sourceUrl: file.link,
      width: file.width,
      height: file.height,
      duration: video.duration,
      url: video.url,
      credit: video.user?.name || 'Pexels creator',
      title: video.url?.split('/').filter(Boolean).at(-1) || 'Pexels finance clip',
    };
  }).filter(Boolean);
}

export async function downloadPexelsClips() {
  mkdirSync(stockDir, { recursive: true });
  const candidates = await searchPexelsCandidates();
  const clips = [];

  for (const [index, video] of candidates.entries()) {
    const clipPath = path.join(stockDir, `clip-${String(index + 1).padStart(2, '0')}.mp4`);
    const clipRes = await fetch(video.sourceUrl);
    if (!clipRes.ok) continue;
    await pipeline(clipRes.body, createWriteStream(clipPath));
    clips.push({
      ...video,
      path: clipPath,
    });
  }

  writeFileSync(path.join(stockDir, 'manifest.json'), JSON.stringify(clips, null, 2));
  return clips;
}

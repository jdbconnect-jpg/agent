import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config, outDir } from './config.mjs';

const stockDir = path.join(outDir, 'stock');

function pickBestVideo(videos = {}) {
  return videos.large?.url ? videos.large
    : videos.medium?.url ? videos.medium
      : videos.small?.url ? videos.small
        : videos.tiny?.url ? videos.tiny
          : null;
}

export async function searchPixabayCandidates({ query = config.pixabay.query, limit = config.pixabay.clips } = {}) {
  if (!config.pixabay.apiKey) {
    console.log('PIXABAY_API_KEY is not set; skipping Pixabay.');
    return [];
  }

  const url = new URL('https://pixabay.com/api/videos/');
  url.searchParams.set('key', config.pixabay.apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', String(Math.max(3, limit)));
  url.searchParams.set('orientation', 'vertical');
  url.searchParams.set('safesearch', 'true');
  url.searchParams.set('order', 'popular');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay API failed: ${res.status} ${res.statusText}`);

  const data = await res.json();
  return (data.hits || []).map((video) => {
    const file = pickBestVideo(video.videos);
    if (!file?.url) return null;
    return {
      id: video.id,
      provider: 'pixabay',
      sourceUrl: file.url,
      downloadUrl: file.url.includes('?') ? `${file.url}&download=1` : `${file.url}?download=1`,
      width: file.width,
      height: file.height,
      duration: video.duration,
      url: video.pageURL,
      credit: video.user || 'Pixabay creator',
      title: [video.tags, video.user].filter(Boolean).join(' '),
    };
  }).filter(Boolean);
}

export async function downloadPixabayClips() {
  mkdirSync(stockDir, { recursive: true });
  const candidates = await searchPixabayCandidates();
  const clips = [];

  for (const [index, video] of candidates.slice(0, config.pixabay.clips).entries()) {
    const clipPath = path.join(stockDir, `pixabay-${String(index + 1).padStart(2, '0')}.mp4`);
    const clipRes = await fetch(video.downloadUrl || video.sourceUrl);
    if (!clipRes.ok) continue;
    await pipeline(clipRes.body, createWriteStream(clipPath));
    clips.push({
      ...video,
      path: clipPath,
    });
  }

  writeFileSync(path.join(stockDir, 'pixabay-manifest.json'), JSON.stringify(clips, null, 2));
  return clips;
}

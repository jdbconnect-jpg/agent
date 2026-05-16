import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config, outDir } from './config.mjs';

function shotstackBaseUrl() {
  const env = config.shotstack.env === 'production' ? 'v1' : 'stage';
  return `https://api.shotstack.io/edit/${env}`;
}

export function buildShotstackEdit(plan, clips) {
  const usable = clips.filter((clip) => clip.sourceUrl);
  if (usable.length === 0) {
    throw new Error('Shotstack requires public sourceUrl values. Run stock download with a supported provider first.');
  }

  let start = 0;
  const videoClips = [];
  const titleClips = [];

  plan.scenes.forEach((scene, index) => {
    const length = Math.max(3, Number(scene.durationSec || 8));
    const stock = usable[index % usable.length];
    videoClips.push({
      asset: {
        type: 'video',
        src: stock.sourceUrl,
        volume: 0,
      },
      start,
      length,
      fit: 'crop',
      scale: 1,
    });
    titleClips.push({
      asset: {
        type: 'title',
        text: `${scene.title}\n${scene.subtitle}`,
        style: 'minimal',
        color: '#ffe900',
        size: 'large',
        background: 'rgba(0,0,0,0.58)',
        position: 'bottom',
      },
      start,
      length,
    });
    start += length;
  });

  return {
    timeline: {
      tracks: [
        { clips: titleClips },
        { clips: videoClips },
      ],
    },
    output: {
      format: 'mp4',
      resolution: 'hd',
      aspectRatio: '9:16',
    },
  };
}

export async function submitShotstackRender() {
  if (!config.shotstack.apiKey) {
    throw new Error('SHOTSTACK_API_KEY is not set.');
  }
  const planPath = path.join(outDir, 'video-plan.json');
  const stockPath = path.join(outDir, 'stock', 'manifest.json');
  if (!existsSync(planPath)) throw new Error('Missing out/video-plan.json. Run npm run generate first.');
  if (!existsSync(stockPath)) throw new Error('Missing stock manifest. Run npm run stock first.');

  const { plan } = JSON.parse(readFileSync(planPath, 'utf8'));
  const clips = JSON.parse(readFileSync(stockPath, 'utf8'));
  const edit = buildShotstackEdit(plan, clips);
  writeFileSync(path.join(outDir, 'shotstack-edit.json'), JSON.stringify(edit, null, 2));

  const res = await fetch(`${shotstackBaseUrl()}/render`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-api-key': config.shotstack.apiKey,
    },
    body: JSON.stringify(edit),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Shotstack render failed: ${res.status} ${JSON.stringify(data)}`);
  writeFileSync(path.join(outDir, 'shotstack-render.json'), JSON.stringify(data, null, 2));
  return data;
}

export async function getShotstackRenderStatus(renderId) {
  if (!config.shotstack.apiKey) {
    throw new Error('SHOTSTACK_API_KEY is not set.');
  }
  const res = await fetch(`${shotstackBaseUrl()}/render/${renderId}`, {
    headers: {
      accept: 'application/json',
      'x-api-key': config.shotstack.apiKey,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Shotstack status failed: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

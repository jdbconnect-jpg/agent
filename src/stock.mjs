import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { outDir } from './config.mjs';
import { searchPexelsCandidates } from './pexels.mjs';
import { searchCoverrCandidates } from './coverr.mjs';
import { searchPixabayCandidates } from './pixabay.mjs';

const stockDir = path.join(outDir, 'stock');

const queryByVisual = {
  hook: ['dividend investing stock market phone', 'investor stock chart finance'],
  number: ['finance calculator investment portfolio', 'stock market analysis calculator'],
  conflict: ['market volatility red stock chart', 'financial risk stock market'],
  risk: ['market downturn red chart investing risk', 'stock market crash warning'],
  close: ['long term investing financial planning', 'portfolio planning stock market'],
};

function sceneQuery(scene) {
  const base = queryByVisual[scene.visual] || queryByVisual.hook;
  const text = `${scene.title || ''} ${scene.subtitle || ''}`;
  if (/배당|dividend/i.test(text)) return 'dividend investing stock market portfolio';
  if (/월|100|원|억|숫자|수익|yield/i.test(text)) return base[0];
  if (/함정|리스크|변동|고정|risk/i.test(text)) return queryByVisual.risk[0];
  return base[0];
}

function scoreCandidate(candidate, scene, usedIds) {
  const width = Number(candidate.width || 0);
  const height = Number(candidate.height || 0);
  const duration = Number(candidate.duration || 0);
  const portrait = height > width;
  const resolution = Math.max(width, height);
  const title = `${candidate.title || ''} ${candidate.url || ''}`.toLowerCase();
  const sceneText = `${scene.title || ''} ${scene.subtitle || ''} ${scene.visual || ''}`.toLowerCase();
  const keywordHits = ['stock', 'market', 'finance', 'invest', 'portfolio', 'dividend', 'chart', 'money']
    .filter((word) => title.includes(word) || sceneText.includes(word)).length;

  let score = 0;
  if (portrait) score += 35;
  if (resolution >= 3840) score += 24;
  else if (resolution >= 2160) score += 18;
  else if (resolution >= 1920) score += 12;
  else if (resolution >= 1080) score += 6;
  if (duration >= 7 && duration <= 20) score += 14;
  else if (duration >= 5) score += 8;
  score += Math.min(keywordHits * 4, 20);
  if (candidate.provider === 'pexels') score += 4;
  if (candidate.provider === 'coverr') score += 2;
  if (usedIds.has(`${candidate.provider}:${candidate.id}`)) score -= 100;
  return score;
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

async function searchAllProviders(query, limit = 8) {
  const results = await Promise.allSettled([
    searchPexelsCandidates({ query, limit }),
    searchCoverrCandidates({ query, limit }),
    searchPixabayCandidates({ query, limit }),
  ]);

  const candidates = [];
  const errors = [];
  for (const result of results) {
    if (result.status === 'fulfilled') candidates.push(...result.value);
    else errors.push(result.reason?.message || String(result.reason));
  }
  return { candidates, errors };
}

async function downloadCandidate(candidate, index) {
  const prefix = `${String(index + 1).padStart(2, '0')}-${candidate.provider}-${safeName(candidate.id) || 'clip'}`;
  const clipPath = path.join(stockDir, `${prefix}.mp4`);
  const clipRes = await fetch(candidate.downloadUrl || candidate.sourceUrl);
  if (!clipRes.ok) throw new Error(`Clip download failed: ${candidate.provider} ${candidate.id} ${clipRes.status}`);
  await pipeline(clipRes.body, createWriteStream(clipPath));
  return {
    ...candidate,
    path: clipPath,
    selectedForScene: index,
  };
}

export async function downloadStockClips(plan = null) {
  mkdirSync(stockDir, { recursive: true });
  const clips = [];
  const errors = [];

  if (!plan?.scenes?.length) {
    const { candidates, errors: providerErrors } = await searchAllProviders('stock market finance investing', 12);
    errors.push(...providerErrors);
    const usedIds = new Set();
    const selected = candidates
      .sort((a, b) => scoreCandidate(b, { visual: 'hook' }, usedIds) - scoreCandidate(a, { visual: 'hook' }, usedIds))
      .slice(0, 6);
    for (const [index, candidate] of selected.entries()) {
      try {
        clips.push(await downloadCandidate(candidate, index));
        usedIds.add(`${candidate.provider}:${candidate.id}`);
      } catch (error) {
        errors.push(error.message);
      }
    }
  } else {
    const usedIds = new Set();
    const candidateLog = [];
    for (const [index, scene] of plan.scenes.entries()) {
      const query = sceneQuery(scene);
      const { candidates, errors: providerErrors } = await searchAllProviders(query, 10);
      errors.push(...providerErrors.map((error) => `scene ${index + 1}: ${error}`));
      const ranked = candidates
        .map((candidate) => ({ ...candidate, query, qualityScore: scoreCandidate(candidate, scene, usedIds) }))
        .sort((a, b) => b.qualityScore - a.qualityScore);
      candidateLog.push({
        scene: index + 1,
        title: scene.title,
        query,
        top: ranked.slice(0, 5).map(({ provider, id, width, height, duration, qualityScore, title }) => ({
          provider,
          id,
          width,
          height,
          duration,
          qualityScore,
          title,
        })),
      });
      const selected = ranked[0];
      if (!selected) continue;
      try {
        clips.push(await downloadCandidate(selected, index));
        usedIds.add(`${selected.provider}:${selected.id}`);
      } catch (error) {
        errors.push(error.message);
      }
    }
    writeFileSync(path.join(stockDir, 'candidate-log.json'), JSON.stringify(candidateLog, null, 2));
  }

  writeFileSync(path.join(stockDir, 'manifest.json'), JSON.stringify(clips, null, 2));
  if (errors.length > 0) {
    writeFileSync(path.join(stockDir, 'errors.json'), JSON.stringify(errors, null, 2));
  }
  return { clips, errors };
}

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { framesDir, outDir, rootDir } from './config.mjs';
import { synthesizeNarration } from './media.mjs';

const W = 1280;
const H = 720;

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrap(text, maxChars, maxLines = 3) {
  const words = String(text ?? '').replace(/[“”‘’]/g, '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function splitSentences(text) {
  const parts = String(text ?? '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？]|[.?!]|다\.|죠\.|요\.|니다\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [String(text ?? '').trim()].filter(Boolean);
}

function outputBaseForPlan(plan) {
  return `${plan.slug || 'browser-longform'}-matched-longform`;
}

function sceneAssetDirForPlan(plan) {
  if (plan.assetDir) return path.isAbsolute(plan.assetDir) ? plan.assetDir : path.join(rootDir, plan.assetDir);
  return path.join(outDir, `ai-scenes-${plan.slug || 'browser-longform'}`);
}

function top5ByTicker(plan) {
  const map = new Map();
  for (const item of plan.research?.top5 || []) {
    for (const key of [item.ticker, item.code, item.name, item.shortName].filter(Boolean)) {
      map.set(String(key).toUpperCase(), item);
    }
  }
  return map;
}

function inferSceneFacts(scene, plan) {
  const top5 = top5ByTicker(plan);
  const sceneText = `${scene.title} ${scene.subtitle} ${scene.narration}`;
  const tickers = [...top5.keys()];
  const ticker = tickers.find((value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(sceneText));
  if (/돈이 몰리는 곳|panda_hook/.test(`${scene.title} ${scene.visual}`)) {
    return {
      kicker: '오프닝 질문',
      main: plan.hookQuestion || '돈이 몰리는 ETF, 나도 따라가야 할까?',
      bullets: [
        plan.openingFact || '최근 ETF 자금 흐름이 강한 상품을 먼저 봅니다.',
        '많이 산다는 사실과 내게 맞는다는 사실은 다릅니다.',
      ],
      tag: 'ETF',
    };
  }
  if (ticker && top5.has(ticker)) {
    const item = top5.get(ticker);
    return {
      kicker: `${item.rank}위 ${item.ticker}`,
      main: item.name || item.shortName,
      bullets: [
        `인기 이유: ${item.reason}`,
        `주의점: ${item.risk}`,
      ],
      tag: item.ticker || item.code || item.shortName,
    };
  }
  if (/TOP 5|다섯/.test(`${scene.title} ${scene.narration}`)) {
    return {
      kicker: '오늘 볼 ETF',
      main: plan.research?.top5?.map((item) => item.shortName || item.ticker || item.name).slice(0, 5).join(' · ') || '대표 ETF 5개',
      bullets: [
        '같은 ETF라도 역할은 완전히 다릅니다.',
        '시장대표, 해외지수, 테마, 현금형을 구분합니다.',
      ],
      tag: 'TOP 5',
    };
  }
  if (/정답|지도|목적지/.test(`${scene.title} ${scene.subtitle} ${scene.narration}`)) {
    return {
      kicker: '핵심 전제',
      main: '순위는 정답지가 아니라 지도입니다',
      bullets: [
        '최근 자금 흐름과 관심도를 함께 봅니다.',
        '내 목적지까지 대신 정해주지는 않습니다.',
      ],
      tag: 'CHECK',
    };
  }
  if (/함정|계획/.test(`${scene.title} ${scene.subtitle}`)) {
    return {
      kicker: '가장 큰 함정',
      main: '왜 사는지 모르면 하락장에서 흔들립니다',
      bullets: [
        '인기 ETF가 나쁜 상품이라는 뜻은 아닙니다.',
        '문제는 내 기준 없이 따라 사는 행동입니다.',
      ],
      tag: 'RISK',
    };
  }
  if (/결론|정리/.test(`${scene.title} ${scene.subtitle}`)) {
    return {
      kicker: '결론',
      main: '남의 인기보다 내 기준이 먼저입니다',
      bullets: [
        '투자 기간, 변동성, 목적을 먼저 정합니다.',
        '순위는 참고 자료일 뿐입니다.',
      ],
      tag: 'END',
    };
  }
  return {
    kicker: '오프닝 질문',
    main: plan.hookQuestion || '돈이 몰리는 ETF, 나도 따라가야 할까?',
    bullets: [
      plan.openingFact || '최근 ETF 자금 흐름이 강한 상품을 먼저 봅니다.',
      '많이 산다는 사실과 내게 맞는다는 사실은 다릅니다.',
    ],
    tag: 'ETF',
  };
}

function sceneAccent(scene) {
  if (/KODEX 200|069500|코스피|KOSPI/.test(`${scene.title} ${scene.subtitle}`)) return '#ffe200';
  if (/S&P500|미국S&P500|360750|379800/.test(`${scene.title} ${scene.subtitle}`)) return '#31e87a';
  if (/나스닥|NASDAQ|133690|379810/.test(`${scene.title} ${scene.subtitle}`)) return '#63e7ff';
  if (/반도체|396500|091160/.test(`${scene.title} ${scene.subtitle}`)) return '#ffcf48';
  if (/CD금리|머니마켓|459580|488770|현금/.test(`${scene.title} ${scene.subtitle}`)) return '#7cffb2';
  if (/IBIT|비트코인/.test(`${scene.title} ${scene.subtitle}`)) return '#ffcf48';
  if (/QQQ|AI/.test(`${scene.title} ${scene.subtitle}`)) return '#63e7ff';
  if (/SGOV|현금|국채/.test(`${scene.title} ${scene.subtitle}`)) return '#7cffb2';
  if (/함정|위험|리스크/.test(`${scene.title} ${scene.subtitle}`)) return '#ff5a70';
  if (/VOO|1위|결론/.test(`${scene.title} ${scene.subtitle}`)) return '#31e87a';
  return '#ffe200';
}

function captionBlock(sentence) {
  const lines = wrap(sentence, 34, 2);
  const y = lines.length > 1 ? 604 : 628;
  return `
    <g>
      <rect x="134" y="${y - 54}" width="1012" height="${lines.length > 1 ? 120 : 84}" rx="8" fill="#000" opacity=".86"/>
      ${lines.map((line, i) => `<text x="640" y="${y + i * 44}" class="caption" text-anchor="middle">${escapeXml(line)}</text>`).join('')}
    </g>`;
}

function simpleTitle(scene, plan) {
  const facts = inferSceneFacts(scene, plan);
  const accent = sceneAccent(scene);
  const title = facts.tag && facts.tag !== 'CHECK' && facts.tag !== 'RISK' && facts.tag !== 'END' && facts.tag !== 'ETF'
    ? `${facts.kicker}`
    : scene.title;
  const titleLines = wrap(title, 16, 2);
  const boxH = titleLines.length > 1 ? 118 : 82;
  return `
    <g transform="translate(158,${titleLines.length > 1 ? 410 : 444})">
      <rect width="524" height="${boxH}" rx="8" fill="#000" opacity=".74"/>
      <rect x="0" y="0" width="10" height="${boxH}" rx="5" fill="${accent}"/>
      ${titleLines.map((line, i) => `<text x="34" y="${titleLines.length > 1 ? 45 + i * 44 : 55}" class="simpleTitle" fill="${accent}">${escapeXml(line)}</text>`).join('')}
    </g>`;
}

function renderOverlaySvg(scene, plan, sentence, sceneIndex) {
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".26"/>
        <stop offset=".42" stop-color="#000" stop-opacity=".32"/>
        <stop offset="1" stop-color="#000" stop-opacity=".9"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="5" dy="6" stdDeviation="0" flood-color="#000" flood-opacity=".95"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .simpleTitle { font-size: 42px; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 4px; }
      .caption { font-size: 36px; fill: #fff; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 4px; }
    </style>
    <rect width="${W}" height="${H}" fill="url(#bottom)"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#050505" stroke-width="22"/>
    ${simpleTitle(scene, plan)}
    ${captionBlock(sentence)}
  </svg>`;
}

function renderThumbnailSvg(plan, scenePath) {
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="7" dy="8" stdDeviation="0" flood-color="#000" flood-opacity=".95"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .big { font-size: 78px; fill: #ffe200; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 6px; }
      .sub { font-size: 50px; fill: #fff; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 5px; }
    </style>
    <image href="${scenePath}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
    <rect width="${W}" height="${H}" fill="#000" opacity=".42"/>
    <rect x="44" y="372" width="1192" height="236" rx="10" fill="#050505" opacity=".82"/>
    <text x="78" y="466" class="big">${escapeXml(plan.thumbnailText?.[0] || 'ETF TOP 5')}</text>
    <text x="78" y="550" class="sub">${escapeXml(plan.thumbnailText?.[2] || '따라 사면 위험?')}</text>
  </svg>`;
}

function allocateDurations(plan, audioDuration) {
  const weights = plan.scenes.map((scene) => Math.max(1, scene.narration.length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((weight) => Math.max(8, audioDuration * (weight / totalWeight)));
}

export async function renderMatchedLongformVideo(plan) {
  mkdirSync(framesDir, { recursive: true });
  const sceneAssetDir = sceneAssetDirForPlan(plan);
  const imagePaths = plan.scenes.map((_, index) => path.join(sceneAssetDir, `scene-${String(index + 1).padStart(2, '0')}.png`));
  const missing = imagePaths.filter((imagePath) => !existsSync(imagePath));
  if (missing.length) throw new Error(`Missing ${missing.length} scene images in ${sceneAssetDir}`);

  const { audioPath } = await synthesizeNarration(plan);
  const audioDuration = Number(execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ], { encoding: 'utf8' }).trim());

  const sceneDurations = allocateDurations(plan, audioDuration);
  const sceneVideoDir = path.join(outDir, 'matched-scene-videos');
  mkdirSync(sceneVideoDir, { recursive: true });
  const sceneVideoPaths = [];

  for (const [sceneIndex, scene] of plan.scenes.entries()) {
    const sentences = splitSentences(scene.narration);
    const weights = sentences.map((sentence) => Math.max(8, sentence.length));
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    const subclips = [];

    for (const [sentenceIndex, sentence] of sentences.entries()) {
      const duration = Math.max(2.8, sceneDurations[sceneIndex] * (weights[sentenceIndex] / totalWeight));
      const overlayPath = path.join(framesDir, `matched-overlay-${String(sceneIndex).padStart(2, '0')}-${String(sentenceIndex).padStart(2, '0')}.png`);
      await sharp(Buffer.from(renderOverlaySvg(scene, plan, sentence, sceneIndex))).png().toFile(overlayPath);
      const clipPath = path.join(sceneVideoDir, `scene-${String(sceneIndex).padStart(2, '0')}-${String(sentenceIndex).padStart(2, '0')}.mp4`);
      const frames = Math.round(duration * 30);
      const zoom = `zoompan=z='min(zoom+0.00012,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=30`;
      execFileSync('ffmpeg', [
        '-y',
        '-loop', '1', '-i', imagePaths[sceneIndex],
        '-loop', '1', '-i', overlayPath,
        '-t', String(duration),
        '-filter_complex',
      `[0:v]scale=1536:864:force_original_aspect_ratio=increase,crop=1536:864,gblur=sigma=1.2,eq=brightness=-0.18:saturation=0.72,${zoom}[bg];[bg][1:v]overlay=0:0,format=yuv420p[v]`,
        '-map', '[v]',
        '-an',
        '-r', '30',
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'medium',
        clipPath,
      ], { stdio: 'ignore' });
      subclips.push(clipPath);
    }

    const sceneConcat = path.join(sceneVideoDir, `scene-${String(sceneIndex).padStart(2, '0')}.ffconcat`);
    writeFileSync(sceneConcat, ['ffconcat version 1.0', ...subclips.map((file) => `file '${file.replaceAll("'", "'\\''")}'`)].join('\n'));
    const sceneVideoPath = path.join(sceneVideoDir, `scene-${String(sceneIndex).padStart(2, '0')}.mp4`);
    execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', sceneConcat, '-c', 'copy', sceneVideoPath], { stdio: 'ignore' });
    sceneVideoPaths.push(sceneVideoPath);
  }

  const concatPath = path.join(outDir, 'matched-scenes.ffconcat');
  writeFileSync(concatPath, ['ffconcat version 1.0', ...sceneVideoPaths.map((file) => `file '${file.replaceAll("'", "'\\''")}'`)].join('\n'));
  const videoPath = path.join(outDir, `${outputBaseForPlan(plan)}.mp4`);
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-i', audioPath,
    '-t', String(audioDuration),
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    videoPath,
  ], { stdio: 'inherit' });

  const thumbnailPath = path.join(outDir, `thumbnail-${plan.slug || 'matched-longform'}.jpg`);
  await sharp(Buffer.from(renderThumbnailSvg(plan, imagePaths[0]))).jpeg({ quality: 93 }).toFile(thumbnailPath);
  return { videoPath, thumbnailPath, audioPath, duration: audioDuration };
}

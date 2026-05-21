import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { framesDir, outDir, rootDir } from './config.mjs';
import { synthesizeNarration } from './media.mjs';

const W = 1280;
const H = 720;
const FINAL_W = Number(process.env.FINAL_VIDEO_WIDTH || 1920);
const FINAL_H = Number(process.env.FINAL_VIDEO_HEIGHT || 1080);

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

function splitLongCaption(text, pieces) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (pieces <= 1 || words.length < pieces * 3) return [String(text ?? '').trim()].filter(Boolean);
  const chunkSize = Math.ceil(words.length / pieces);
  const chunks = [];
  for (let index = 0; index < words.length; index += chunkSize) {
    chunks.push(words.slice(index, index + chunkSize).join(' '));
  }
  return chunks;
}

function buildCaptionSegments(scene, sceneDuration) {
  const minCut = Number(process.env.MIN_SCENE_CUT_SEC || 5);
  const maxCut = Number(process.env.MAX_SCENE_CUT_SEC || 12);
  const oneLine = process.env.ONE_LINE_CAPTIONS === '1';
  const maxCaptionChars = oneLine ? 42 : 68;
  const sentences = splitSentences(scene.narration);
  const weights = sentences.map((sentence) => Math.max(8, sentence.length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const rawSegments = sentences.flatMap((sentence, sentenceIndex) => {
    const duration = Math.max(2.8, sceneDuration * (weights[sentenceIndex] / totalWeight));
    const pieces = Math.max(1, Math.ceil(duration / maxCut), Math.ceil(sentence.length / maxCaptionChars));
    const captions = splitLongCaption(sentence, pieces);
    return captions.map((caption, pieceIndex) => ({
      caption,
      duration: duration / captions.length,
      sentenceIndex,
      pieceIndex,
    }));
  });

  const segments = [];
  for (const segment of rawSegments) {
    const previous = segments.at(-1);
    const mergedCaption = previous ? `${previous.caption} ${segment.caption}`.trim() : '';
    const canMergeCaption = !oneLine || mergedCaption.length <= maxCaptionChars;
    if (previous && canMergeCaption && (previous.duration < minCut || segment.duration < minCut) && previous.duration + segment.duration <= maxCut) {
      previous.caption = `${previous.caption} ${segment.caption}`.trim();
      previous.duration += segment.duration;
      continue;
    }
    segments.push({ ...segment });
  }

  if (segments.length > 1 && segments.at(-1).duration < minCut) {
    const last = segments.pop();
    const previous = segments.at(-1);
    const mergedCaption = `${previous.caption} ${last.caption}`.trim();
    if ((!oneLine || mergedCaption.length <= maxCaptionChars) && previous.duration + last.duration <= maxCut) {
      previous.caption = `${previous.caption} ${last.caption}`.trim();
      previous.duration += last.duration;
    } else {
      const target = Math.min(maxCut, Math.max(minCut, (previous.duration + last.duration) / 2));
      last.duration = previous.duration + last.duration - target;
      previous.duration = target;
      segments.push(last);
    }
  }

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = segments[index + 1];
    if (segment.duration >= minCut || next.duration <= minCut) continue;
    const borrowed = Math.min(minCut - segment.duration, next.duration - minCut);
    segment.duration += borrowed;
    next.duration -= borrowed;
  }

  for (let index = segments.length - 1; index > 0; index -= 1) {
    const segment = segments[index];
    const previous = segments[index - 1];
    if (segment.duration >= minCut || previous.duration <= minCut) continue;
    const borrowed = Math.min(minCut - segment.duration, previous.duration - minCut);
    previous.duration -= borrowed;
    segment.duration += borrowed;
  }

  const durationTotal = segments.reduce((sum, segment) => sum + segment.duration, 0);
  if (durationTotal > 0 && Math.abs(durationTotal - sceneDuration) > 0.001) {
    const ratio = sceneDuration / durationTotal;
    for (const segment of segments) segment.duration *= ratio;
    const correctedTotal = segments.reduce((sum, segment) => sum + segment.duration, 0);
    segments[segments.length - 1].duration += sceneDuration - correctedTotal;
  }

  return segments.map((segment, index) => ({ ...segment, cutIndex: index }));
}

function staticCropFilter(cutIndex) {
  if (process.env.STABLE_SCENE_CROP === '1') {
    return `scale=1320:742:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-${W})/2:(ih-${H})/2`;
  }
  const positions = [
    '0:0',
    '(iw-1280)/2:(ih-720)/2',
    '(iw-1280):0',
    '0:(ih-720)',
    '(iw-1280):(ih-720)',
  ];
  return `scale=1344:756:force_original_aspect_ratio=increase,crop=${W}:${H}:${positions[cutIndex % positions.length]}`;
}

function outputBaseForPlan(plan) {
  if (plan.outputBase) return plan.outputBase;
  return `${plan.slug || 'browser-longform'}-matched-longform`;
}

function sceneAssetDirForPlan(plan) {
  if (plan.assetDir) return path.isAbsolute(plan.assetDir) ? plan.assetDir : path.join(rootDir, plan.assetDir);
  return path.join(outDir, `ai-scenes-${plan.slug || 'browser-longform'}`);
}

function imageDataHref(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${readFileSync(imagePath).toString('base64')}`;
}

function optionalCutawayPath(sceneIndex) {
  const sceneFile = `scene-${String(sceneIndex + 1).padStart(2, '0')}.mp4`;
  const candidates = [
    path.join(outDir, 'gemini-videos', sceneFile),
    path.join(outDir, 'heygen', sceneFile),
  ];
  return candidates.find((file) => existsSync(file)) || null;
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
  const oneLine = process.env.ONE_LINE_CAPTIONS === '1';
  const lines = wrap(sentence, oneLine ? 48 : 34, oneLine ? 1 : 2);
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
  const disableBottomGradient = process.env.NO_BOTTOM_GRADIENT === '1';
  const hideSceneTitle = process.env.HIDE_SCENE_TITLE === '1';
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".04"/>
        <stop offset=".5" stop-color="#000" stop-opacity=".08"/>
        <stop offset="1" stop-color="#000" stop-opacity=".56"/>
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
    ${disableBottomGradient ? '' : `<rect width="${W}" height="${H}" fill="url(#bottom)"/>`}
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#050505" stroke-width="22"/>
    ${hideSceneTitle ? '' : simpleTitle(scene, plan)}
    ${captionBlock(sentence)}
  </svg>`;
}

function ffmpegQuote(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function captionTimingMetadata(segments) {
  let cursor = 0;
  return segments.map((segment) => {
    const start = cursor;
    cursor += segment.duration;
    return {
      ...segment,
      start,
      end: cursor,
    };
  });
}

function renderThumbnailSvg(plan, scenePath) {
  const eyebrow = plan.thumbnailEyebrow || (/국장|국내|한국|KODEX|TIGER|ACE/i.test(`${plan.title} ${plan.description}`) ? '국장 ETF TOP 5' : 'ETF TOP 5');
  const headlineLines = wrap(plan.thumbnailText?.[0] || 'ETF 처음이면', 8, 2);
  const warningLine = plan.thumbnailSentence || '이 5개만 보세요';
  const stickerText = plan.thumbnailSticker || '모르면 손해';
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".95"/>
        <stop offset=".56" stop-color="#000" stop-opacity=".64"/>
        <stop offset=".78" stop-color="#000" stop-opacity=".22"/>
        <stop offset="1" stop-color="#000" stop-opacity=".05"/>
      </linearGradient>
      <radialGradient id="hot" cx="74%" cy="37%" r="42%">
        <stop offset="0" stop-color="#ffe200" stop-opacity=".34"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".45"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="7" dy="8" stdDeviation="0" flood-color="#000" flood-opacity=".95"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .eyebrow { font-size: 42px; fill: #050505; }
      .big { font-size: 112px; fill: #ffe200; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 8px; }
      .risk { font-size: 54px; fill: #ff4f67; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 5px; }
      .small { font-size: 36px; fill: #fff; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 4px; }
    </style>
    <image href="${scenePath}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
    <rect width="${W}" height="${H}" fill="url(#hot)"/>
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
    <rect width="${W}" height="${H}" fill="url(#bottomShade)"/>
    <rect x="42" y="38" width="374" height="74" rx="8" fill="#ffe200"/>
    <text x="229" y="90" class="eyebrow" text-anchor="middle">${escapeXml(eyebrow)}</text>
    ${headlineLines.map((line, i) => `<text x="70" y="${260 + i * 108}" class="big">${escapeXml(line)}</text>`).join('')}
    <rect x="54" y="426" width="780" height="116" rx="8" fill="#050505" opacity=".58"/>
    <text x="72" y="508" class="risk">${escapeXml(warningLine)}</text>
    <g transform="translate(845,78) rotate(8)">
      <rect x="0" y="0" width="250" height="78" rx="10" fill="#ff3150"/>
      <text x="125" y="53" text-anchor="middle" class="small">${escapeXml(stickerText)}</text>
    </g>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#050505" stroke-width="16"/>
  </svg>`;
}

function allocateDurations(plan, audioDuration) {
  const minScene = Number(process.env.MIN_SCENE_DURATION_SEC || process.env.MIN_SCENE_CUT_SEC || 5);
  const maxScene = Number(process.env.MAX_SCENE_DURATION_SEC || process.env.MAX_SCENE_CUT_SEC || 12);
  const sceneCount = plan.scenes.length;
  const weights = plan.scenes.map((scene) => Math.max(1, scene.narration.length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (audioDuration <= minScene * sceneCount) {
    return weights.map((weight) => audioDuration * (weight / totalWeight));
  }

  const durations = weights.map(() => minScene);
  let remaining = audioDuration - minScene * sceneCount;
  const open = new Set(weights.map((_, index) => index));

  while (remaining > 0.001 && open.size) {
    const openWeight = [...open].reduce((sum, index) => sum + weights[index], 0);
    let distributed = 0;
    for (const index of [...open]) {
      const room = maxScene - durations[index];
      const add = Math.min(room, remaining * (weights[index] / openWeight));
      durations[index] += add;
      distributed += add;
      if (durations[index] >= maxScene - 0.001) open.delete(index);
    }
    if (distributed <= 0.001) break;
    remaining -= distributed;
  }

  if (remaining > 0.001) {
    const extra = remaining / sceneCount;
    for (let index = 0; index < durations.length; index += 1) durations[index] += extra;
  }

  const correction = audioDuration - durations.reduce((sum, value) => sum + value, 0);
  durations[durations.length - 1] += correction;
  return durations;
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
  rmSync(sceneVideoDir, { recursive: true, force: true });
  mkdirSync(sceneVideoDir, { recursive: true });
  const sceneVideoPaths = [];

  for (const [sceneIndex, scene] of plan.scenes.entries()) {
    const segments = captionTimingMetadata(buildCaptionSegments(scene, sceneDurations[sceneIndex]));
    const sceneDuration = segments.reduce((sum, segment) => sum + segment.duration, 0);
    const overlayPaths = [];

    for (const segment of segments) {
      const overlayPath = path.join(framesDir, `matched-overlay-${String(sceneIndex).padStart(2, '0')}-${String(segment.cutIndex).padStart(2, '0')}.png`);
      await sharp(Buffer.from(renderOverlaySvg(scene, plan, segment.caption, sceneIndex))).png().toFile(overlayPath);
      overlayPaths.push(overlayPath);
    }

    const sceneVideoPath = path.join(sceneVideoDir, `scene-${String(sceneIndex).padStart(2, '0')}.mp4`);
    const cutawayPath = optionalCutawayPath(sceneIndex);
    const inputs = cutawayPath
      ? ['-stream_loop', '-1', '-i', cutawayPath]
      : ['-loop', '1', '-i', imagePaths[sceneIndex]];
    for (const overlayPath of overlayPaths) {
      inputs.push('-loop', '1', '-i', overlayPath);
    }

    const imageBrightness = Number(process.env.IMAGE_BRIGHTNESS ?? (cutawayPath ? 0.08 : 0.12));
    const baseFilter = cutawayPath
      ? `[0:v]${staticCropFilter(0)},eq=brightness=${imageBrightness}:saturation=1.04[bg0]`
      : `[0:v]${staticCropFilter(0)},gblur=sigma=0.25,eq=brightness=${imageBrightness}:saturation=1.05[bg0]`;
    const overlayFilters = segments.map((segment, index) => {
      const inputLabel = index === 0 ? 'bg0' : `bg${index}`;
      const outputLabel = index === segments.length - 1 ? 'v' : `bg${index + 1}`;
      return `[${inputLabel}][${index + 1}:v]overlay=0:0:enable='between(t,${segment.start.toFixed(3)},${segment.end.toFixed(3)})'[${outputLabel}]`;
    });
    const filterComplex = `${baseFilter};${overlayFilters.join(';')};[v]format=yuv420p[outv]`;

    execFileSync('ffmpeg', [
      '-y',
      ...inputs,
      '-t', String(sceneDuration),
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-an',
      '-r', '30',
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'medium',
      sceneVideoPath,
    ], { stdio: 'ignore' });

    const timingPath = path.join(sceneVideoDir, `scene-${String(sceneIndex).padStart(2, '0')}.caption-timing.json`);
    writeFileSync(timingPath, JSON.stringify({
      sceneIndex,
      duration: sceneDuration,
      captions: segments.map(({ caption, duration, start, end, cutIndex }) => ({
        cutIndex,
        caption,
        duration,
        start,
        end,
      })),
    }, null, 2));
    sceneVideoPaths.push(sceneVideoPath);
  }

  const concatPath = path.join(outDir, 'matched-scenes.ffconcat');
  writeFileSync(concatPath, ['ffconcat version 1.0', ...sceneVideoPaths.map((file) => `file '${file.replaceAll("'", "'\\''")}'`)].join('\n'));
  const videoPath = path.join(outDir, `${outputBaseForPlan(plan)}.mp4`);
  const finalVideoArgs = [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-i', audioPath,
    '-t', String(audioDuration),
    '-map', '0:v:0',
    '-map', '1:a:0',
  ];
  if (FINAL_W !== W || FINAL_H !== H) {
    finalVideoArgs.push(
      '-vf', `scale=${FINAL_W}:${FINAL_H}:flags=lanczos,format=yuv420p`,
      '-r', '30',
      '-c:v', 'libx264',
      '-crf', process.env.FINAL_VIDEO_CRF || '16',
      '-preset', process.env.FINAL_VIDEO_PRESET || 'medium',
    );
  } else {
    finalVideoArgs.push('-c:v', 'copy');
  }
  finalVideoArgs.push(
    '-c:a', 'aac',
    '-b:a', '192k',
    videoPath,
  );
  execFileSync('ffmpeg', finalVideoArgs, { stdio: 'inherit' });

  const thumbnailSceneIndex = Math.min(
    imagePaths.length - 1,
    Math.max(0, Number(plan.thumbnailSourceScene || 1) - 1),
  );
  const thumbnailPath = path.join(outDir, `thumbnail-${plan.slug || 'matched-longform'}.jpg`);
  await renderMatchedThumbnail(plan, imagePaths[thumbnailSceneIndex], thumbnailPath);
  return { videoPath, thumbnailPath, audioPath, duration: audioDuration };
}

export async function renderMatchedThumbnail(plan, scenePath = null, thumbnailPath = null) {
  const sceneAssetDir = sceneAssetDirForPlan(plan);
  const sourcePath = scenePath || path.join(sceneAssetDir, 'scene-01.png');
  if (!existsSync(sourcePath)) throw new Error(`Missing thumbnail source image: ${sourcePath}`);
  const outputPath = thumbnailPath || path.join(outDir, `thumbnail-${plan.slug || 'matched-longform'}.jpg`);
  await sharp(Buffer.from(renderThumbnailSvg(plan, imageDataHref(sourcePath)))).jpeg({ quality: 94 }).toFile(outputPath);
  return outputPath;
}

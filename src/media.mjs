import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import OpenAI from 'openai';
import sharp from 'sharp';
import { config, framesDir, outDir } from './config.mjs';

const W = 1080;
const H = 1920;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrap(text, maxChars) {
  const words = String(text).split(/\s+/);
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
  return lines.slice(0, 4);
}

function srtTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}

export function writeCaptions(plan) {
  let cursor = 0;
  const blocks = [];
  for (const [index, scene] of plan.scenes.entries()) {
    const duration = Math.max(3, Number(scene.durationSec || 8));
    const lines = wrap(scene.narration, 28).join('\n');
    blocks.push(`${index + 1}\n${srtTime(cursor)} --> ${srtTime(cursor + duration)}\n${lines}`);
    cursor += duration;
  }
  const captionsPath = path.join(outDir, 'captions.srt');
  writeFileSync(captionsPath, `${blocks.join('\n\n')}\n`);
  return captionsPath;
}

function scenePalette(visual) {
  return {
    hook: ['#051018', '#102a31', '#ffe900'],
    number: ['#080b11', '#14233f', '#00e676'],
    conflict: ['#10090b', '#351319', '#ff335f'],
    risk: ['#090a0d', '#2a220d', '#ffd400'],
    close: ['#07110e', '#102b20', '#7cffb2'],
  }[visual] || ['#080b11', '#14233f', '#ffd400'];
}

function financeGridSvg() {
  const candles = Array.from({ length: 18 }, (_, i) => {
    const x = 105 + i * 52;
    const y = 420 + Math.sin(i * 0.8) * 70 - i * 10;
    const up = i % 3 !== 0;
    const color = up ? '#2dfc84' : '#ff4d6d';
    return `<line x1="${x}" y1="${y - 42}" x2="${x}" y2="${y + 42}" stroke="${color}" stroke-width="6" opacity=".7"/>
      <rect x="${x - 14}" y="${up ? y - 24 : y - 5}" width="28" height="48" rx="4" fill="${color}" opacity=".8"/>`;
  }).join('');

  return `
    <g opacity=".28">
      ${Array.from({ length: 10 }, (_, i) => `<line x1="70" y1="${330 + i * 90}" x2="1010" y2="${330 + i * 90}" stroke="#ffffff" stroke-width="1"/>`).join('')}
      ${Array.from({ length: 8 }, (_, i) => `<line x1="${100 + i * 125}" y1="300" x2="${100 + i * 125}" y2="1160" stroke="#ffffff" stroke-width="1"/>`).join('')}
    </g>
    <g transform="translate(0,120)">${candles}</g>
    <path d="M120 980 C 280 870, 390 900, 530 760 S 780 590, 960 420" fill="none" stroke="#39ff88" stroke-width="22" stroke-linecap="round" opacity=".9"/>
    <path d="M880 430 L972 410 L940 498" fill="none" stroke="#39ff88" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function renderSceneSvg(scene, index, total, { transparent = false, ticker = 'ETF' } = {}) {
  const [bg1, bg2, accent] = scenePalette(scene.visual);
  const titleLines = wrap(scene.title, 11);
  const subtitleLines = wrap(scene.subtitle, 14);
  const titleFont = titleLines.length >= 3 ? 78 : titleLines.length === 2 ? 92 : 104;
  const titleGap = titleLines.length >= 3 ? 90 : 106;
  const subtitleFont = subtitleLines.length >= 3 ? 46 : 54;
  const subtitleGap = subtitleLines.length >= 3 ? 56 : 66;
  const titleY = titleLines.length > 1 ? 948 : 1012;
  const titleText = titleLines.map((line, i) =>
    `<text x="540" y="${titleY + i * titleGap}" text-anchor="middle" class="title">${escapeXml(line)}</text>`
  ).join('');
  const subtitleText = subtitleLines.map((line, i) =>
    `<text x="540" y="${titleY + titleLines.length * titleGap + 54 + i * subtitleGap}" text-anchor="middle" class="subtitle">${escapeXml(line)}</text>`
  ).join('');

  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stop-color="${bg2}"/>
        <stop offset="68%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="#020305"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000" flood-opacity=".8"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .title { fill: ${accent}; font-size: ${titleFont}px; filter: url(#shadow); }
      .subtitle { fill: #ffffff; font-size: ${subtitleFont}px; filter: url(#shadow); }
      .notice { fill: #d7e8ec; font-size: 26px; font-weight: 800; }
    </style>
    ${transparent ? '<rect width="1080" height="1920" fill="#000" opacity=".38"/>' : `<rect width="1080" height="1920" fill="url(#glow)"/>
    <rect x="0" y="0" width="1080" height="1920" fill="#000" opacity=".18"/>`}
    ${financeGridSvg()}
    <g transform="translate(154,104)">
      <rect width="772" height="46" rx="10" fill="#06161f" opacity=".78"/>
      <text x="386" y="31" text-anchor="middle" class="notice">${escapeXml(ticker)} 배당성장 ETF, JEPQ 말고 볼 만할까?</text>
    </g>
    <rect x="70" y="870" width="940" height="410" rx="24" fill="#000" opacity=".66"/>
    ${titleText}
    ${subtitleText}
  </svg>`;
}

function renderThumbnailSvg(plan) {
  const ticker = plan.ticker || 'ETF';
  const headline = wrap(plan.thumbnailText[0] || `${ticker} 월 100만?`, 12);
  const sub = wrap(plan.thumbnailText.slice(1).join(' ') || '필요 원금 공개', 16);
  return `
  <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg" cx="55%" cy="38%" r="75%">
        <stop offset="0%" stop-color="#17353a"/>
        <stop offset="70%" stop-color="#061017"/>
        <stop offset="100%" stop-color="#020305"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#000" flood-opacity=".85"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .ticker { fill: #d7f9ff; font-size: 42px; }
      .big { fill: #ffe900; font-size: 112px; filter: url(#shadow); }
      .sub { fill: #ffffff; font-size: 72px; filter: url(#shadow); }
      .red { fill: #ff405d; }
    </style>
    <rect width="1280" height="720" fill="url(#bg)"/>
    <g opacity=".26">
      ${Array.from({ length: 7 }, (_, i) => `<line x1="54" y1="${80 + i * 92}" x2="1226" y2="${80 + i * 92}" stroke="#fff"/>`).join('')}
      ${Array.from({ length: 9 }, (_, i) => `<line x1="${80 + i * 140}" y1="42" x2="${80 + i * 140}" y2="680" stroke="#fff"/>`).join('')}
    </g>
    <path d="M760 600 C 860 505, 948 430, 1032 286 S 1145 138, 1212 74" fill="none" stroke="#32f586" stroke-width="28" stroke-linecap="round"/>
    <path d="M1122 72 L1224 58 L1200 158" fill="none" stroke="#32f586" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(64,48)">
      <rect width="196" height="66" rx="10" fill="#06161f" stroke="#ffe900" stroke-width="3"/>
      <text x="98" y="46" text-anchor="middle" class="ticker">${escapeXml(ticker)}</text>
    </g>
    <rect x="54" y="158" width="810" height="430" rx="28" fill="#000" opacity=".66"/>
    ${headline.map((line, i) => `<text x="100" y="${290 + i * 116}" class="big">${escapeXml(line)}</text>`).join('')}
    ${sub.map((line, i) => `<text x="100" y="${520 + i * 76}" class="sub ${i === 0 ? 'red' : ''}">${escapeXml(line)}</text>`).join('')}
  </svg>`;
}

export async function synthesizeNarration(plan) {
  const narration = plan.scenes.map((scene) => scene.narration).join('\n\n');
  const spokenNarration = narration
    .replace(/(^|[\n\r]|[,.!?]\s*)이\s+ETF/g, '$1이 티 에프')
    .replace(/\bETF\b/g, '이 티 에프')
    .replace(/\bETFs\b/g, '이 티 에프들')
    .replace(/\bJEPQ\b/g, '제이 이 피 큐')
    .replace(/\bSCHD\b/g, '에스 씨 에이치 디')
    .replace(/\bS&P\s*500\b/g, '에스 앤 피 오백')
    .replace(/\bQQQ\b/g, '큐 큐 큐');
  const narrationPath = path.join(outDir, 'narration.txt');
  const spokenNarrationPath = path.join(outDir, 'narration-tts.txt');
  const audioPath = path.join(outDir, 'narration.mp3');
  writeFileSync(narrationPath, narration);
  writeFileSync(spokenNarrationPath, spokenNarration);

  const totalDuration = plan.scenes.reduce((sum, scene) => sum + Number(scene.durationSec || 8), 0);

  if (config.ttsProvider === 'elevenlabs' && config.elevenLabs.apiKey) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabs.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': config.elevenLabs.apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: spokenNarration,
        model_id: config.elevenLabs.modelId,
        voice_settings: {
          stability: 0.52,
          similarity_boost: 0.78,
          style: 0.18,
          use_speaker_boost: true,
        },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
    writeFileSync(audioPath, Buffer.from(await res.arrayBuffer()));
    return { audioPath, narrationPath, aiVoice: true, provider: 'elevenlabs' };
  }

  if (!config.openaiApiKey) {
    const aiffPath = path.join(outDir, 'narration-system.aiff');
    const systemVoice = process.env.SYSTEM_TTS_VOICE || 'Yuna';
    const systemRate = process.env.SYSTEM_TTS_RATE || '205';
    try {
      execFileSync('say', ['-v', systemVoice, '-r', systemRate, '-o', aiffPath, '-f', spokenNarrationPath], { stdio: 'ignore' });
      execFileSync('ffmpeg', ['-y', '-i', aiffPath, '-codec:a', 'libmp3lame', '-b:a', '128k', audioPath], { stdio: 'ignore' });
      return { audioPath, narrationPath, aiVoice: false, provider: 'system-say' };
    } catch {
      // Fall back to silent audio if local speech synthesis is unavailable.
    }
    execFileSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`,
      '-t', String(totalDuration), '-q:a', '9', '-acodec', 'libmp3lame', audioPath,
    ], { stdio: 'ignore' });
    return { audioPath, narrationPath, aiVoice: false, provider: 'silent' };
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const speech = await client.audio.speech.create({
    model: config.ttsModel,
    voice: config.ttsVoice,
    input: spokenNarration,
    response_format: 'mp3',
  });
  const buffer = Buffer.from(await speech.arrayBuffer());
  writeFileSync(audioPath, buffer);
  return { audioPath, narrationPath, aiVoice: true, provider: 'openai' };
}

export async function renderVideo(plan) {
  const captionsPath = writeCaptions(plan);
  const stockManifestPath = path.join(outDir, 'stock', 'manifest.json');
  const stockClips = existsSync(stockManifestPath)
    ? JSON.parse(readFileSync(stockManifestPath, 'utf8')).filter((clip) => existsSync(clip.path))
    : [];

  const framePaths = [];
  for (const [index, scene] of plan.scenes.entries()) {
    const svg = renderSceneSvg(scene, index, plan.scenes.length, { transparent: stockClips.length > 0, ticker: plan.ticker });
    const framePath = path.join(framesDir, `scene-${String(index).padStart(2, '0')}.png`);
    await sharp(Buffer.from(svg)).png().toFile(framePath);
    framePaths.push(framePath);
  }

  await sharp(Buffer.from(renderThumbnailSvg(plan))).jpeg({ quality: 92 }).toFile(path.join(outDir, 'thumbnail.jpg'));

  const { audioPath } = await synthesizeNarration(plan);
  const videoPath = path.join(outDir, 'jepq-monthly-income.mp4');
  if (stockClips.length > 0) {
    const sceneVideoDir = path.join(outDir, 'scene-videos');
    mkdirSync(sceneVideoDir, { recursive: true });
    const sceneVideoPaths = [];

    for (const [index, scene] of plan.scenes.entries()) {
      const clip = stockClips[index % stockClips.length];
      const sceneVideoPath = path.join(sceneVideoDir, `scene-${String(index).padStart(2, '0')}.mp4`);
      execFileSync('ffmpeg', [
        '-y',
        '-stream_loop', '-1', '-i', clip.path,
        '-loop', '1', '-i', framePaths[index],
        '-t', String(Math.max(3, Number(scene.durationSec || 8))),
        '-filter_complex',
        '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=brightness=-0.18:saturation=0.82[bg];[bg][1:v]overlay=0:0,format=yuv420p[v]',
        '-map', '[v]',
        '-an',
        '-r', '30',
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'medium',
        sceneVideoPath,
      ], { stdio: 'inherit' });
      sceneVideoPaths.push(sceneVideoPath);
    }

    const concatPath = path.join(outDir, 'scenes-video.ffconcat');
    writeFileSync(concatPath, ['ffconcat version 1.0', ...sceneVideoPaths.map((file) => `file '${file.replaceAll("'", "'\\''")}'`)].join('\n'));
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-i', audioPath,
      '-i', captionsPath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-map', '2:s:0',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-c:s', 'mov_text',
      '-metadata:s:s:0', 'language=kor',
      videoPath,
    ], { stdio: 'inherit' });
  } else {
    const concatPath = path.join(outDir, 'scenes.ffconcat');
    const lines = ['ffconcat version 1.0'];
    plan.scenes.forEach((scene, index) => {
      lines.push(`file '${framePaths[index].replaceAll("'", "'\\''")}'`);
      lines.push(`duration ${Math.max(3, Number(scene.durationSec || 8))}`);
    });
    lines.push(`file '${framePaths.at(-1).replaceAll("'", "'\\''")}'`);
    writeFileSync(concatPath, lines.join('\n'));

    const args = [
      '-y',
      '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-i', audioPath,
      '-i', captionsPath,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
      '-r', '30',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-map', '2:s:0',
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-crf', '18',
      '-preset', 'medium',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-c:s', 'mov_text',
      '-metadata:s:s:0', 'language=kor',
      videoPath,
    ];
    execFileSync('ffmpeg', args, { stdio: 'inherit' });
  }

  if (!existsSync(videoPath)) throw new Error('Video render failed.');
  return { videoPath, thumbnailPath: path.join(outDir, 'thumbnail.jpg'), audioPath };
}

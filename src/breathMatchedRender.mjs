import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import OpenAI from 'openai';
import sharp from 'sharp';
import { config, framesDir, outDir, rootDir } from './config.mjs';

const W = 1280;
const H = 720;

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function spokenText(text) {
  return String(text ?? '')
    .replace(/\bETF\b/g, '이 티 에프')
    .replace(/\bTOP10\b/g, '탑 텐')
    .replace(/\bTOP3\b/g, '탑 쓰리')
    .replace(/\bKODEX\b/g, '코덱스')
    .replace(/\bTIGER\b/g, '타이거')
    .replace(/\bAI\b/g, '에이 아이')
    .replace(/S&P500/g, '에스 앤 피 오백')
    .replace(/나스닥100/g, '나스닥 백')
    .replace(/CD금리액티브/g, '시디 금리 액티브')
    .replace(/\bKRX\b/g, '케이 알 엑스')
    .replace(/091160/g, '공 구 일 일 육 공')
    .replace(/471990/g, '사 칠 일 구 구 공')
    .replace(/396500/g, '삼 구 육 오 공 공');
}

function wrap(text, maxChars = 34, maxLines = 2) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
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

function splitCaptionSegments(text, maxChars = 34) {
  const sentences = String(text ?? '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？]|다\.|죠\.|요\.|니다\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const source = sentences.length ? sentences : [String(text ?? '').trim()].filter(Boolean);
  const chunks = [];
  for (const sentence of source) {
    const words = sentence.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxChars && line) {
        chunks.push(line);
        line = word;
      } else {
        line = (line + ' ' + word).trim();
      }
    }
    if (line) chunks.push(line);
  }
  return chunks.length ? chunks.slice(0, 4) : [String(text ?? '').trim()].filter(Boolean);
}

function imageDir(plan) {
  return path.isAbsolute(plan.assetDir) ? plan.assetDir : path.join(rootDir, plan.assetDir);
}

function staticCropFilter() {
  return `scale=1320:742:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-${W})/2:(ih-${H})/2`;
}

function overlaySvg(scene, caption, delaySec) {
  const line = wrap(caption, 42, 1)[0] || '';
  const y = 628;
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="5" dy="6" stdDeviation="0" flood-color="#000" flood-opacity=".95"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .caption { font-size: 36px; fill: #fff; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 4px; }
    </style>
    <rect x="134" y="${y - 54}" width="1012" height="84" rx="8" fill="#000" opacity=".86"/>
    <text x="640" y="${y}" class="caption" text-anchor="middle">${escapeXml(line)}</text>
  </svg>`;
}

async function synthesizeRawAudio(text, outPath) {
  const ttsText = spokenText(text);
  if (config.ttsProvider === 'elevenlabs' && config.elevenLabs.apiKey) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabs.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': config.elevenLabs.apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: ttsText,
        model_id: config.elevenLabs.modelId,
        voice_settings: {
          stability: 0.54,
          similarity_boost: 0.78,
          style: 0.16,
          use_speaker_boost: true,
        },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
    writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  } else if (config.openaiApiKey) {
    const client = new OpenAI({ apiKey: config.openaiApiKey });
    const speech = await client.audio.speech.create({
      model: config.ttsModel,
      voice: config.ttsVoice,
      input: ttsText,
      response_format: 'mp3',
    });
    writeFileSync(outPath, Buffer.from(await speech.arrayBuffer()));
  } else {
    const textPath = outPath.replace(/\.mp3$/, '.txt');
    const aiffPath = outPath.replace(/\.mp3$/, '.aiff');
    writeFileSync(textPath, ttsText);
    execFileSync('say', ['-v', process.env.SYSTEM_TTS_VOICE || 'Yuna', '-r', process.env.SYSTEM_TTS_RATE || '205', '-o', aiffPath, '-f', textPath], { stdio: 'ignore' });
    execFileSync('ffmpeg', ['-y', '-i', aiffPath, '-codec:a', 'libmp3lame', '-b:a', '128k', outPath], { stdio: 'ignore' });
  }
  return outPath;
}

async function synthesizeSceneAudio(text, index, dir) {
  const rawPath = path.join(dir, `scene-${String(index).padStart(2, '0')}-raw.mp3`);
  const outPath = path.join(dir, `scene-${String(index).padStart(2, '0')}.mp3`);
  await synthesizeRawAudio(text, rawPath);

  const prePause = Number(process.env.SCENE_PRE_PAUSE_SEC || 0.35);
  const postPause = Number(process.env.SCENE_POST_PAUSE_SEC || 0.22);
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-t', String(prePause), '-i', 'anullsrc=channel_layout=mono:sample_rate=44100',
    '-i', rawPath,
    '-f', 'lavfi', '-t', String(postPause), '-i', 'anullsrc=channel_layout=mono:sample_rate=44100',
    '-filter_complex', '[0:a][1:a][2:a]concat=n=3:v=0:a=1[a]',
    '-map', '[a]',
    '-codec:a', 'libmp3lame',
    '-b:a', '128k',
    outPath,
  ], { stdio: 'ignore' });
  return outPath;
}

async function synthesizeContinuousSceneAudio(text, captionSegments, index, dir) {
  const audioPath = await synthesizeSceneAudio(text, index, dir);
  const sceneDuration = duration(audioPath);
  const prePause = Number(process.env.SCENE_PRE_PAUSE_SEC || 0.35);
  const postPause = Number(process.env.SCENE_POST_PAUSE_SEC || 0.22);
  const captionLead = Number(process.env.CAPTION_LEAD_SEC || 0.04);
  const captionTail = Number(process.env.CAPTION_TAIL_SEC || 0.08);
  const speechStart = prePause;
  const speechEnd = Math.max(speechStart, sceneDuration - postPause);
  const speechDuration = Math.max(0.1, speechEnd - speechStart);
  const weights = captionSegments.map((caption) => Math.max(1, spokenText(caption).length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = speechStart;
  const timeline = captionSegments.map((caption, segmentIndex) => {
    const isLast = segmentIndex === captionSegments.length - 1;
    const segmentDuration = isLast
      ? Math.max(0.1, speechEnd - cursor)
      : Math.max(0.6, speechDuration * (weights[segmentIndex] / totalWeight));
    const start = Math.max(0, cursor - captionLead);
    const end = isLast ? sceneDuration : Math.min(sceneDuration, cursor + segmentDuration + captionTail);
    const item = {
      caption,
      start,
      end,
      audioStart: cursor,
      audioEnd: Math.min(speechEnd, cursor + segmentDuration),
      duration: Math.min(speechEnd, cursor + segmentDuration) - cursor,
    };
    cursor = Math.min(speechEnd, cursor + segmentDuration);
    return item;
  });
  return { audioPath, timeline };
}

async function synthesizeSyncedSceneAudio(captionSegments, index, dir) {
  const prePause = Number(process.env.SCENE_PRE_PAUSE_SEC || 0.35);
  const postPause = Number(process.env.SCENE_POST_PAUSE_SEC || 0.22);
  const betweenPause = Number(process.env.CAPTION_BETWEEN_PAUSE_SEC || 0.08);
  const outPath = path.join(dir, `scene-${String(index).padStart(2, '0')}.mp3`);
  const inputs = [
    '-f', 'lavfi', '-t', String(prePause), '-i', 'anullsrc=channel_layout=mono:sample_rate=44100',
  ];
  const timeline = [];
  let cursor = prePause;

  for (const [segmentIndex, caption] of captionSegments.entries()) {
    const rawPath = path.join(dir, `scene-${String(index).padStart(2, '0')}-${String(segmentIndex).padStart(2, '0')}-raw.mp3`);
    await synthesizeRawAudio(caption, rawPath);
    const rawDuration = duration(rawPath);
    inputs.push('-i', rawPath);
    timeline.push({
      caption,
      start: Math.max(0, cursor - Number(process.env.CAPTION_LEAD_SEC || 0.04)),
      end: cursor + rawDuration + Number(process.env.CAPTION_TAIL_SEC || 0.06),
      audioStart: cursor,
      audioEnd: cursor + rawDuration,
      duration: rawDuration,
    });
    cursor += rawDuration;
    if (segmentIndex < captionSegments.length - 1) {
      inputs.push('-f', 'lavfi', '-t', String(betweenPause), '-i', 'anullsrc=channel_layout=mono:sample_rate=44100');
      cursor += betweenPause;
    }
  }

  inputs.push('-f', 'lavfi', '-t', String(postPause), '-i', 'anullsrc=channel_layout=mono:sample_rate=44100');
  const inputCount = inputs.filter((value) => value === '-i').length;
  const concatInputs = Array.from({ length: inputCount }, (_, inputIndex) => `[${inputIndex}:a]`).join('');
  execFileSync('ffmpeg', [
    '-y',
    ...inputs,
    '-filter_complex', `${concatInputs}concat=n=${inputCount}:v=0:a=1[a]`,
    '-map', '[a]',
    '-codec:a', 'libmp3lame',
    '-b:a', '128k',
    outPath,
  ], { stdio: 'ignore' });

  return { audioPath: outPath, timeline };
}

function duration(file) {
  return Number(execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ], { encoding: 'utf8' }).trim());
}

export async function renderBreathMatchedVideo(plan) {
  mkdirSync(framesDir, { recursive: true });
  const audioDir = path.join(outDir, 'breath-scene-audio');
  const sceneDir = path.join(outDir, 'breath-scene-videos');
  rmSync(audioDir, { recursive: true, force: true });
  rmSync(sceneDir, { recursive: true, force: true });
  mkdirSync(audioDir, { recursive: true });
  mkdirSync(sceneDir, { recursive: true });

  const assets = imageDir(plan);
  const videoFiles = [];
  const audioFiles = [];
  const timings = [];
  const brightness = Number(process.env.IMAGE_BRIGHTNESS ?? 0.02);
  const prePause = Number(process.env.SCENE_PRE_PAUSE_SEC || 0.35);

  for (const [index, scene] of plan.scenes.entries()) {
    const imagePath = path.join(assets, `scene-${String(index + 1).padStart(2, '0')}.png`);
    if (!existsSync(imagePath)) throw new Error(`Missing image: ${imagePath}`);
    const captionSegments = splitCaptionSegments(scene.narration);
    const syncCaptions = process.env.SYNC_CAPTION_AUDIO !== '0';
    const continuousSceneAudio = process.env.CONTINUOUS_SCENE_AUDIO !== '0';
    const synced = syncCaptions
      ? (continuousSceneAudio
          ? await synthesizeContinuousSceneAudio(scene.narration, captionSegments, index, audioDir)
          : await synthesizeSyncedSceneAudio(captionSegments, index, audioDir))
      : { audioPath: await synthesizeSceneAudio(scene.narration, index, audioDir), timeline: null };
    const audioPath = synced.audioPath;
    const sceneDuration = duration(audioPath);
    const overlayPaths = [];
    for (const [segmentIndex, caption] of captionSegments.entries()) {
      const overlayPath = path.join(framesDir, `breath-overlay-${String(index).padStart(2, '0')}-${String(segmentIndex).padStart(2, '0')}.png`);
      await sharp(Buffer.from(overlaySvg(scene, caption, prePause))).png().toFile(overlayPath);
      overlayPaths.push(overlayPath);
    }
    const sceneVideoPath = path.join(sceneDir, `scene-${String(index).padStart(2, '0')}.mp4`);
    const inputs = [
      '-y',
      '-loop', '1', '-i', imagePath,
    ];
    for (const overlayPath of overlayPaths) inputs.push('-loop', '1', '-i', overlayPath);
    inputs.push('-i', audioPath);
    const overlayFilters = overlayPaths.map((_, segmentIndex) => {
      const inputLabel = segmentIndex === 0 ? 'bg' : `v${segmentIndex}`;
      const outputLabel = segmentIndex === overlayPaths.length - 1 ? 'v' : `v${segmentIndex + 1}`;
      const timing = synced.timeline?.[segmentIndex];
      const start = timing?.start ?? (prePause + segmentIndex * Math.max(0.1, (sceneDuration - prePause) / overlayPaths.length));
      const end = timing?.end ?? (segmentIndex === overlayPaths.length - 1 ? sceneDuration : prePause + (segmentIndex + 1) * Math.max(0.1, (sceneDuration - prePause) / overlayPaths.length));
      return `[${inputLabel}][${segmentIndex + 1}:v]overlay=0:0:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'[${outputLabel}]`;
    });
    const audioInputIndex = overlayPaths.length + 1;
    execFileSync('ffmpeg', [
      ...inputs,
      '-t', String(sceneDuration),
      '-filter_complex', `[0:v]${staticCropFilter()},gblur=sigma=0.25,eq=brightness=${brightness}:saturation=1.05[bg];${overlayFilters.join(';')};[v]format=yuv420p[outv]`,
      '-map', '[outv]',
      '-map', `${audioInputIndex}:a:0`,
      '-r', '30',
      '-c:v', 'libx264',
      '-crf', '16',
      '-preset', 'medium',
      '-c:a', 'aac',
      '-b:a', '192k',
      sceneVideoPath,
    ], { stdio: 'ignore' });
    videoFiles.push(sceneVideoPath);
    audioFiles.push(audioPath);
    timings.push({ index, title: scene.title, subtitle: scene.subtitle, duration: sceneDuration, prePause, captions: captionSegments, captionTimeline: synced.timeline });
  }

  const concatPath = path.join(outDir, 'breath-scenes.ffconcat');
  writeFileSync(concatPath, ['ffconcat version 1.0', ...videoFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`)].join('\n'));
  const videoPath = path.join(outDir, `${plan.outputBase || plan.slug}-breath.mp4`);
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-c', 'copy',
    videoPath,
  ], { stdio: 'ignore' });
  writeFileSync(path.join(outDir, `${plan.outputBase || plan.slug}-breath-timing.json`), JSON.stringify(timings, null, 2));
  writeFileSync(path.join(outDir, 'narration.txt'), plan.scenes.map((scene) => scene.narration).join('\n\n'));
  return { videoPath, timings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const payload = JSON.parse(readFileSync(process.argv[2] || path.join(outDir, 'video-plan.json'), 'utf8'));
  const plan = payload.plan || payload;
  renderBreathMatchedVideo(plan)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

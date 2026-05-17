import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import OpenAI from 'openai';
import sharp from 'sharp';
import { config, framesDir, outDir } from './config.mjs';
import { synthesizeNarration, writeCaptions } from './media.mjs';

const W = 1280;
const H = 720;

function sceneAssetDirForPlan(plan) {
  if (plan?.assetDir) return path.isAbsolute(plan.assetDir) ? plan.assetDir : path.join(rootDirFromOut(), plan.assetDir);
  if (plan?.slug) return path.join(outDir, `ai-scenes-${plan.slug}`);
  return path.join(outDir, plan?.format === 'panda-documentary' ? 'ai-scenes-panda-top-etfs' : 'ai-scenes');
}

function outputBaseForPlan(plan) {
  if (plan?.outputBase) return plan.outputBase;
  if (plan?.slug) return `${plan.slug}-longform`;
  return plan?.format === 'panda-documentary' ? 'panda-etf-top5-longform' : 'schd-illustrated-documentary-longform';
}

function rootDirFromOut() {
  return path.resolve(outDir, '..');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrap(text, maxChars, maxLines = 3) {
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
  return lines.slice(0, maxLines);
}

export function scenePrompt(scene, plan, index) {
  if (scene?.imagePrompt) {
    return [
      scene.imagePrompt,
      '',
      'Mandatory visual rules:',
      '- Create one polished 16:9 cinematic illustration for a Korean YouTube longform finance video.',
      '- Keep the same recurring character design if a character is described.',
      '- Do not include readable text, letters, numbers, ticker labels, logos, UI screenshots, or watermarks inside the image.',
      '- Keep the lower 36 percent visually calm and darker because Korean captions and titles will be added later.',
      `- Scene ${index + 1} of ${plan.scenes.length}: ${scene.title} / ${scene.subtitle}.`,
    ].join('\n');
  }

  if (plan?.format === 'panda-documentary') {
    const character = plan.character?.consistencyPrompt || 'same cute panda teacher character in every scene';
    const etfContext = plan.research?.candidates
      ?.map((item) => `${item.ticker}: ${item.angle}; caution: ${item.risk}`)
      .join(' | ');
    return [
      'Create one polished 16:9 Korean YouTube finance explainer illustration.',
      `Character consistency, very important: ${character}. The panda must look like the same character in every scene.`,
      'Visual style: cute premium editorial animation still, soft hand-painted texture, clean cinematic composition, warm light, high production value, family-friendly, not childish clutter.',
      'Composition: panda teacher explains the topic with simple props, leave the lower 36 percent darker and visually calm for Korean captions.',
      'No readable text, no letters, no numbers, no ticker symbols, no logos, no watermark, no UI screenshots inside the image.',
      `Scene ${index + 1} of ${plan.scenes.length}: ${scene.title} / ${scene.subtitle}.`,
      `Scene idea: ${scene.narration}`,
      etfContext ? `Background research context, do not write this as text: ${etfContext}` : '',
    ].filter(Boolean).join('\n');
  }

  const artDirection = [
    'Korean editorial documentary illustration for a finance explainer video.',
    'Hand-drawn ink outlines, textured paper, cinematic composition, warm muted colors, high production value.',
    'Rich scene detail, clear foreground and background depth, no flat vector icons, no stock-photo realism.',
    'Leave the lower 38 percent of the frame visually calm and darker so Korean title captions can be overlaid later.',
    'No readable text, no letters, no logos, no watermark, no UI screenshots.',
    '16:9 widescreen frame, strong YouTube documentary thumbnail quality.',
  ].join(' ');
  const subjects = {
    temptation: 'A modern Korean investor at a desk looking at a phone with dividend cashflow symbols, subtle money calendar motif, curious but cautious mood.',
    yield: 'A comparison scene with a modest dividend yield chart, one low steady bar group and one flashy high-yield sign implied without text, thoughtful investor reaction.',
    compare: 'Two paths on a desk: one path with fast monthly cashflow imagery, the other with slow-growing sturdy company buildings and dividend leaves, balanced scale motif.',
    calculation: 'A dramatic calculation desk scene with calculator, papers, coins, and a large empty display space for a number overlay, serious reality-check mood.',
    calendar: 'Quarterly dividend concept: calendar pages, envelopes arriving every few months, investor planning monthly budget from quarterly cashflow.',
    risk: 'Market volatility concept: chart line drops and recovers, umbrella over portfolio, investor calmly watching storm outside window.',
    close: 'Long-term investing conclusion: calm investor looking at a growing tree made of dividend leaves and stock certificates, sunrise mood.',
  };
  return `${artDirection}\nScene ${index + 1} of ${plan.scenes.length}: ${subjects[scene.visual] || subjects.close}\nNarrative cue: ${scene.title} / ${scene.subtitle}`;
}

async function generateSceneImages(plan, { force = false } = {}) {
  const sceneAssetDir = sceneAssetDirForPlan(plan);
  mkdirSync(sceneAssetDir, { recursive: true });
  const missing = plan.scenes
    .map((_, index) => path.join(sceneAssetDir, `scene-${String(index + 1).padStart(2, '0')}.png`))
    .filter((scenePath) => !existsSync(scenePath) || force);
  if (missing.length > 0 && plan?.format === 'browser-longform') {
    throw new Error([
      'Browser longform scene images must be generated through ChatGPT browser automation first.',
      `Missing ${missing.length} image(s) in ${sceneAssetDir}.`,
      'Run: npm run chatgpt:chrome-longform-images -- --force',
      'Finally: npm run longform:browser-render',
    ].join('\n'));
  }
  if (missing.length > 0 && plan?.format === 'panda-documentary') {
    throw new Error([
      'Panda ETF scenes must be generated through ChatGPT browser automation first.',
      `Missing ${missing.length} image(s) in ${sceneAssetDir}.`,
      'Run: npm run chatgpt:panda-script',
      'Then: npm run chatgpt:panda-images -- --force',
      'Finally: npm run longform:panda-etfs',
    ].join('\n'));
  }
  if (missing.length > 0 && !config.openaiApiKey && !config.geminiApiKey) {
    throw new Error([
      'OPENAI_API_KEY or GEMINI_API_KEY is required for automatic illustrated scene generation.',
      `Manual option: create images from prompts and save them as ${path.join(sceneAssetDir, 'scene-01.png')} ... scene-${String(plan.scenes.length).padStart(2, '0')}.png`,
      'Run: npm run image-prompts',
    ].join('\n'));
  }
  const client = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;
  const outputs = [];

  for (const [index, scene] of plan.scenes.entries()) {
    const scenePath = path.join(sceneAssetDir, `scene-${String(index + 1).padStart(2, '0')}.png`);
    if (existsSync(scenePath) && !force) {
      outputs.push(scenePath);
      continue;
    }

    console.log(`Generating illustrated scene ${index + 1}/${plan.scenes.length}: ${scene.title}`);
    const prompt = scenePrompt(scene, plan, index);
    const b64 = client
      ? await generateOpenAIImage(client, prompt)
      : await generateGeminiImage(prompt);
    if (!b64) throw new Error(`Image generation returned no image for scene ${index + 1}`);
    await sharp(Buffer.from(b64, 'base64'))
      .resize(W, H, { fit: 'cover', position: 'center' })
      .png()
      .toFile(scenePath);
    outputs.push(scenePath);
  }
  return outputs;
}

export function writeChatGptImagePromptPack(plan) {
  const sceneAssetDir = sceneAssetDirForPlan(plan);
  const promptDir = path.join(outDir, 'chatgpt-image-prompts');
  mkdirSync(promptDir, { recursive: true });
  const scenePaths = [];
  const markdown = [
    '# ChatGPT Image Prompts',
    '',
    'ChatGPT 맥 앱에서 아래 프롬프트를 한 장면씩 넣고 이미지를 생성하세요.',
    `생성한 이미지는 \`${sceneAssetDir}\` 폴더에 \`scene-01.png\`부터 \`scene-${String(plan.scenes.length).padStart(2, '0')}.png\`까지 저장하면 됩니다.`,
    '',
    '다운로드 폴더에 순서대로 저장했다면 `npm run import:downloads`로 최신 이미지 7장을 자동 복사할 수 있습니다.',
    '',
  ];

  for (const [index, scene] of plan.scenes.entries()) {
    const fileName = `scene-${String(index + 1).padStart(2, '0')}.txt`;
    const prompt = [
      scenePrompt(scene, plan, index),
      '',
      'Important output rules:',
      '- Create one polished 16:9 illustration.',
      '- Do not include any readable text, letters, numbers, logos, watermarks, or UI screenshots inside the image.',
      '- Keep the lower 38% visually calm and darker because Korean captions will be added later.',
      `- This is scene ${index + 1}. Save/download it as scene-${String(index + 1).padStart(2, '0')}.png.`,
    ].join('\n');
    const promptPath = path.join(promptDir, fileName);
    writeFileSync(promptPath, prompt);
    scenePaths.push(promptPath);
    markdown.push(`## Scene ${index + 1}: ${scene.title}`, '', '```text', prompt, '```', '');
  }

  const markdownPath = path.join(outDir, 'chatgpt-image-prompts.md');
  writeFileSync(markdownPath, markdown.join('\n'));
  return { promptDir, markdownPath, scenePaths, sceneAssetDir };
}

export async function importLatestDownloadedImages(plan, { sourceDir = path.join(os.homedir(), 'Downloads') } = {}) {
  const sceneAssetDir = sceneAssetDirForPlan(plan);
  mkdirSync(sceneAssetDir, { recursive: true });
  const imageFiles = readdirSync(sourceDir)
    .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
    .map((file) => {
      const fullPath = path.join(sourceDir, file);
      return { fullPath, mtimeMs: statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, plan.scenes.length)
    .reverse();

  if (imageFiles.length < plan.scenes.length) {
    throw new Error(`Need ${plan.scenes.length} images in ${sourceDir}, found ${imageFiles.length}.`);
  }

  const imported = [];
  for (const [index, image] of imageFiles.entries()) {
    const targetPath = path.join(sceneAssetDir, `scene-${String(index + 1).padStart(2, '0')}.png`);
    await sharp(image.fullPath)
      .resize(W, H, { fit: 'cover', position: 'center' })
      .png()
      .toFile(targetPath);
    imported.push({ from: image.fullPath, to: targetPath });
  }
  return imported;
}

async function generateOpenAIImage(client, prompt) {
  const response = await client.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    prompt,
    size: process.env.OPENAI_IMAGE_SIZE || '1536x1024',
    quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
    output_format: 'png',
    background: 'opaque',
    n: 1,
  });
  return response.data?.[0]?.b64_json;
}

async function generateGeminiImage(prompt) {
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': config.geminiApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${prompt}\nGenerate one polished 16:9 image only. Do not include any readable text inside the image.`,
        }],
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    return generateImagenImage(prompt, `Gemini image generation failed: ${res.status} ${JSON.stringify(json)}`);
  }
  const parts = json.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  return imagePart?.inlineData?.data || imagePart?.inline_data?.data;
}

async function generateImagenImage(prompt, priorError) {
  const model = process.env.IMAGEN_MODEL || 'imagen-4.0-generate-001';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': config.geminiApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '16:9',
        personGeneration: 'allow_adult',
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${priorError}\nImagen fallback failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json.predictions?.[0]?.bytesBase64Encoded || json.predictions?.[0]?.image?.bytesBase64Encoded;
}

function accentFor(scene) {
  return {
    temptation: '#ffe200',
    yield: '#ffe200',
    compare: '#ffffff',
    calculation: '#31e87a',
    calendar: '#ffe200',
    risk: '#ff4865',
    close: '#7cffb2',
    panda_hook: '#ffe200',
    panda_cash: '#7cffb2',
    panda_crypto: '#ffcf48',
    panda_ai: '#63e7ff',
    panda_index: '#ffffff',
    panda_winner: '#31e87a',
    panda_warning: '#ff4865',
    panda_close: '#7cffb2',
  }[scene.visual] || '#ffe200';
}

function overlaySvg(scene) {
  const accent = accentFor(scene);
  const titleLines = wrap(scene.title, 13, 2);
  const subtitleLines = wrap(scene.subtitle, 24, 2);
  const titleSize = titleLines.length > 1 ? 70 : 86;
  const boxH = titleLines.length > 1 || subtitleLines.length > 1 ? 250 : 218;

  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".18"/>
        <stop offset=".52" stop-color="#000" stop-opacity="0"/>
        <stop offset=".78" stop-color="#000" stop-opacity=".56"/>
        <stop offset="1" stop-color="#000" stop-opacity=".82"/>
      </linearGradient>
      <filter id="hardShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="7" dy="8" stdDeviation="0" flood-color="#000" flood-opacity=".95"/>
      </filter>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000" flood-opacity=".5"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .title { fill: ${accent}; filter: url(#hardShadow); paint-order: stroke; stroke: #000; stroke-width: 5px; }
      .subtitle { fill: #fff; filter: url(#hardShadow); paint-order: stroke; stroke: #000; stroke-width: 4px; }
      .chip { fill: #fff; font-size: 28px; }
    </style>
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#0b0b0b" stroke-width="30"/>
    <rect x="38" y="${650 - boxH}" width="1168" height="${boxH}" rx="8" fill="#050505" opacity=".74"/>
    ${titleLines.map((line, i) =>
      `<text x="76" y="${650 - boxH + 78 + i * 78}" class="title" font-size="${titleSize}">${escapeXml(line)}</text>`
    ).join('')}
    ${subtitleLines.map((line, i) =>
      `<text x="78" y="${650 - boxH + 172 + i * 52}" class="subtitle" font-size="44">${escapeXml(line)}</text>`
    ).join('')}
  </svg>`;
}

function thumbnailSvg(plan, scenePath) {
  const headline = plan.thumbnailText?.[1] || 'SCHD를 보는 진짜 이유';
  const sub = plan.thumbnailText?.[2] || '월 100만 원의 현실';
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="hardShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="7" dy="8" stdDeviation="0" flood-color="#000" flood-opacity=".95"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .big { fill: #ffe200; font-size: 78px; filter: url(#hardShadow); paint-order: stroke; stroke: #000; stroke-width: 6px; }
      .sub { fill: #fff; font-size: 58px; filter: url(#hardShadow); paint-order: stroke; stroke: #000; stroke-width: 5px; }
    </style>
    <image href="${scenePath}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
    <rect width="${W}" height="${H}" fill="#000" opacity=".24"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#0b0b0b" stroke-width="30"/>
    <rect x="34" y="388" width="1208" height="264" rx="8" fill="#050505" opacity=".78"/>
    <text x="66" y="488" class="big">${escapeXml(headline)}</text>
    <text x="66" y="582" class="sub">${escapeXml(sub)}</text>
  </svg>`;
}

export async function renderIllustratedDocumentaryVideo(plan) {
  mkdirSync(framesDir, { recursive: true });
  const captionsPath = writeCaptions(plan);
  const imagePaths = await generateSceneImages(plan);

  const overlayPaths = [];
  for (const [index, scene] of plan.scenes.entries()) {
    const overlayPath = path.join(framesDir, `illustrated-overlay-${String(index).padStart(2, '0')}.png`);
    await sharp(Buffer.from(overlaySvg(scene)))
      .png()
      .toFile(overlayPath);
    overlayPaths.push(overlayPath);
  }

  const outputBase = outputBaseForPlan(plan);
  const thumbnailPath = path.join(outDir, plan?.thumbnailFile || (plan?.format === 'panda-documentary' ? 'thumbnail-panda-etf-top5.jpg' : 'thumbnail-illustrated.jpg'));
  await sharp(Buffer.from(thumbnailSvg(plan, imagePaths[0]))).jpeg({ quality: 93 }).toFile(thumbnailPath);

  const { audioPath } = await synthesizeNarration(plan);
  const sceneVideoDir = path.join(outDir, 'illustrated-scene-videos');
  mkdirSync(sceneVideoDir, { recursive: true });
  const sceneVideoPaths = [];

  for (const [index, scene] of plan.scenes.entries()) {
    const duration = Math.max(3, Number(scene.durationSec || 8));
    const frames = Math.round(duration * 30);
    const sceneVideoPath = path.join(sceneVideoDir, `scene-${String(index).padStart(2, '0')}.mp4`);
    const zoomRate = plan?.format === 'panda-documentary' ? '0.00018' : '0.00028';
    const zoomMax = plan?.format === 'panda-documentary' ? '1.035' : '1.055';
    const zoom = `zoompan=z='min(zoom+${zoomRate},${zoomMax})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=30`;
    execFileSync('ffmpeg', [
      '-y',
      '-loop', '1', '-i', imagePaths[index],
      '-loop', '1', '-i', overlayPaths[index],
      '-t', String(duration),
      '-filter_complex',
      `[0:v]scale=1536:864:force_original_aspect_ratio=increase,crop=1536:864,${zoom}[bg];[bg][1:v]overlay=0:0,format=yuv420p[v]`,
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

  const concatPath = path.join(outDir, 'illustrated-scenes.ffconcat');
  writeFileSync(concatPath, ['ffconcat version 1.0', ...sceneVideoPaths.map((file) => `file '${file.replaceAll("'", "'\\''")}'`)].join('\n'));
  const videoPath = path.join(outDir, `${outputBase}.mp4`);
  const audioDuration = Number(execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ], { encoding: 'utf8' }).trim());

  execFileSync('ffmpeg', [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-i', audioPath,
    '-i', captionsPath,
    '-t', String(audioDuration),
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

  if (!existsSync(videoPath)) throw new Error('Illustrated documentary video render failed.');
  return { videoPath, thumbnailPath, audioPath };
}

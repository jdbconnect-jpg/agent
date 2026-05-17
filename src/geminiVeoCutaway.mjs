import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { config, outDir } from './config.mjs';

function argValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY is required.');
  const scene = argValue('scene', '02');
  const inputImage = argValue('image', path.join(outDir, 'gemini-video-inputs', `scene-${scene}.png`));
  const outputVideo = argValue('output', path.join(outDir, 'gemini-videos', `scene-${scene}.mp4`));
  const promptFile = path.join(outDir, 'gemini-video-manifest.json');
  let prompt = argValue('prompt');

  if (!prompt && existsSync(promptFile)) {
    const manifest = JSON.parse(readFileSync(promptFile, 'utf8'));
    const item = manifest.items?.find((entry) => String(entry.sceneNumber).padStart(2, '0') === scene);
    prompt = item?.prompt;
  }

  if (!prompt) throw new Error('Missing Gemini video prompt.');
  if (!existsSync(inputImage)) throw new Error(`Missing input image: ${inputImage}`);

  mkdirSync(path.dirname(outputVideo), { recursive: true });
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  let operation = await ai.models.generateVideos({
    model: process.env.GEMINI_VIDEO_MODEL || 'veo-3.1-fast-generate-preview',
    source: {
      prompt,
      image: {
        imageBytes: readFileSync(inputImage).toString('base64'),
        mimeType: 'image/png',
      },
    },
    config: {
      numberOfVideos: 1,
      durationSeconds: 8,
      aspectRatio: '16:9',
      resolution: '720p',
      negativePrompt: 'camera shake, jitter, fast zoom, readable text, logo, watermark, subtitles, captions, UI screen',
    },
  });

  writeFileSync(path.join(outDir, `gemini-veo-operation-scene-${scene}.json`), `${JSON.stringify(operation, null, 2)}\n`);
  console.log(`Started Gemini Veo operation: ${operation.name}`);

  const started = Date.now();
  while (!operation.done) {
    if (Date.now() - started > 12 * 60 * 1000) {
      throw new Error(`Gemini Veo operation timed out: ${operation.name}`);
    }
    await sleep(10_000);
    operation = await ai.operations.getVideosOperation({ operation });
    console.log(`Gemini Veo status: done=${Boolean(operation.done)}`);
  }

  if (operation.error) {
    throw new Error(`Gemini Veo failed: ${JSON.stringify(operation.error)}`);
  }

  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) throw new Error(`Gemini Veo response did not include a video: ${JSON.stringify(operation.response)}`);

  if (video.videoBytes) {
    writeFileSync(outputVideo, Buffer.from(video.videoBytes, 'base64'));
  } else if (video.uri) {
    const response = await fetch(video.uri);
    if (!response.ok) throw new Error(`Failed to download Gemini video: ${response.status} ${response.statusText}`);
    writeFileSync(outputVideo, Buffer.from(await response.arrayBuffer()));
  } else {
    throw new Error(`Gemini Veo video has no bytes or URI: ${JSON.stringify(video)}`);
  }

  writeFileSync(path.join(outDir, `gemini-veo-operation-scene-${scene}.json`), `${JSON.stringify(operation, null, 2)}\n`);
  console.log(`Saved Gemini Veo video: ${outputVideo}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

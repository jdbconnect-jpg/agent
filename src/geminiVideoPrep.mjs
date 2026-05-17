import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { outDir, rootDir } from './config.mjs';

const W = 1280;
const H = 720;
const MAX_DAILY_GEMINI_VIDEOS = 3;

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function loadPlan() {
  const planPath = path.join(outDir, 'browser-longform-plan.json');
  if (!existsSync(planPath)) throw new Error(`Missing plan file: ${planPath}`);
  const data = JSON.parse(readFileSync(planPath, 'utf8'));
  return data.plan || data;
}

function sceneAssetDirForPlan(plan) {
  if (plan.assetDir) return path.isAbsolute(plan.assetDir) ? plan.assetDir : path.join(rootDir, plan.assetDir);
  return path.join(outDir, `ai-scenes-${plan.slug || 'browser-longform'}`);
}

function unique(values) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))];
}

function defaultScenes(plan) {
  const total = plan.scenes.length;
  const riskScene = plan.scenes.findIndex((scene) => /함정|위험|리스크|주의|결론|정리/.test(`${scene.title} ${scene.subtitle} ${scene.narration}`)) + 1;
  return unique([
    1,
    Math.max(1, Math.ceil(total / 2)),
    riskScene || total,
  ]).slice(0, MAX_DAILY_GEMINI_VIDEOS);
}

function selectedScenes(plan) {
  const requested = argValue('scenes');
  const sceneNumbers = requested
    ? unique(requested.split(',').map((value) => Number(value.trim())))
    : defaultScenes(plan);

  return sceneNumbers
    .filter((sceneNumber) => sceneNumber <= plan.scenes.length)
    .slice(0, MAX_DAILY_GEMINI_VIDEOS);
}

function promptFor(plan, scene, sceneNumber) {
  const character = plan.character?.consistencyPrompt || 'same cute panda teacher character, black round glasses, mint green bow tie, beige cardigan, warm friendly expression';
  return [
    `Create an 8-second muted video from the uploaded image for a Korean YouTube finance documentary.`,
    ``,
    `Scene ${String(sceneNumber).padStart(2, '0')}: ${scene.title}`,
    `Narrative cue: ${scene.subtitle || scene.narration}`,
    ``,
    `Character consistency: ${character}. Keep the panda teacher visually consistent with the uploaded image.`,
    ``,
    `Motion direction: gentle, stable documentary motion only. Use very slow natural movement such as a small head turn, subtle pointer gesture, soft light movement, or gentle background parallax. Do not shake the camera. Do not use fast zooms, spins, jitter, glitch effects, jump cuts, or chaotic movement.`,
    ``,
    `Audio rule: no audio, muted, silent output. The final YouTube narration will be added separately.`,
    ``,
    `Visual safety rules: no readable text, no Korean or English letters, no numbers, no ETF tickers, no logos, no watermark, no UI screens, no charts with readable labels. Keep the lower 38 percent visually calm and darker because Korean subtitles will be added later.`,
    ``,
    `Output: one polished 16:9 video, exactly 8 seconds if possible, suitable as a clean cutaway inside a YouTube finance video.`,
  ].join('\n');
}

async function prepareImage(sourcePath, targetPath) {
  await sharp(sourcePath)
    .resize(W, H, { fit: 'cover' })
    .png()
    .toFile(targetPath);
}

async function main() {
  const plan = loadPlan();
  const assetDir = sceneAssetDirForPlan(plan);
  const inputDir = path.join(outDir, 'gemini-video-inputs');
  const videoDir = path.join(outDir, 'gemini-videos');
  mkdirSync(inputDir, { recursive: true });
  mkdirSync(videoDir, { recursive: true });

  const manifest = [];
  for (const sceneNumber of selectedScenes(plan)) {
    const scene = plan.scenes[sceneNumber - 1];
    const label = String(sceneNumber).padStart(2, '0');
    const sourceImage = path.join(assetDir, `scene-${label}.png`);
    if (!existsSync(sourceImage)) throw new Error(`Missing scene image: ${sourceImage}`);

    const inputImage = path.join(inputDir, `scene-${label}.png`);
    const targetVideo = path.join(videoDir, `scene-${label}.mp4`);
    const prompt = promptFor(plan, scene, sceneNumber);
    await prepareImage(sourceImage, inputImage);

    manifest.push({
      sceneNumber,
      title: scene.title,
      subtitle: scene.subtitle || '',
      inputImage,
      targetVideo,
      prompt,
    });
  }

  const promptMd = [
    '# Gemini 8-second muted video prompts',
    '',
    `Gemini 하루 생성 제한을 고려해 기본 ${MAX_DAILY_GEMINI_VIDEOS}개 씬만 준비합니다.`,
    '각 입력 이미지를 Gemini에 업로드하고, 아래 프롬프트를 붙여넣은 뒤 생성된 mp4를 지정된 위치에 저장하세요.',
    '렌더러는 이 파일들을 자동으로 찾아 영상에 넣고, 최종 합성 시 컷어웨이 오디오는 제거합니다.',
    '',
    ...manifest.flatMap((item) => [
      `## Scene ${String(item.sceneNumber).padStart(2, '0')} - ${item.title}`,
      '',
      `Input image: \`${item.inputImage}\``,
      `Save downloaded video as: \`${item.targetVideo}\``,
      '',
      '```text',
      item.prompt,
      '```',
      '',
    ]),
  ].join('\n');

  const manifestPath = path.join(outDir, 'gemini-video-manifest.json');
  const promptPath = path.join(outDir, 'gemini-video-prompts.md');
  writeFileSync(manifestPath, `${JSON.stringify({ maxDailyVideos: MAX_DAILY_GEMINI_VIDEOS, items: manifest }, null, 2)}\n`);
  writeFileSync(promptPath, promptMd);

  console.log(`Prepared ${manifest.length} Gemini video prompts.`);
  console.log(`Prompts: ${promptPath}`);
  console.log(`Manifest: ${manifestPath}`);
  for (const item of manifest) {
    console.log(`Scene ${String(item.sceneNumber).padStart(2, '0')}: ${item.inputImage} -> ${item.targetVideo}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

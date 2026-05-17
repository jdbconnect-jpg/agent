import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { outDir } from './config.mjs';
import { getFinanceSnapshot } from './finance.mjs';
import { generateDocumentaryLongformVideoPlan, generateLongformVideoPlan, generatePandaPopularEtfPlan, generateVideoPlan } from './scriptAgent.mjs';
import { renderVideo } from './media.mjs';
import { renderDocumentaryVideo } from './documentaryMedia.mjs';
import { importLatestDownloadedImages, renderIllustratedDocumentaryVideo, writeChatGptImagePromptPack } from './illustratedMedia.mjs';
import { uploadVideo } from './upload.mjs';
import { downloadStockClips } from './stock.mjs';
import { getShotstackRenderStatus, submitShotstackRender } from './shotstack.mjs';

async function loadOrGeneratePlan({ forceFallback = false } = {}) {
  const planPath = path.join(outDir, 'video-plan.json');
  if (existsSync(planPath) && !forceFallback) {
    return JSON.parse(readFileSync(planPath, 'utf8')).plan;
  }
  const snapshot = await getFinanceSnapshot();
  return generateVideoPlan(snapshot, { forceFallback });
}

async function main() {
  const command = process.argv[2] || 'run';

  if (command === 'generate') {
    const snapshot = await getFinanceSnapshot();
    const plan = await generateVideoPlan(snapshot);
    console.log(`Generated plan: ${path.join(outDir, 'video-plan.json')}`);
    console.log(plan.title);
    return;
  }

  if (command === 'render') {
    const plan = await loadOrGeneratePlan();
    const result = await renderVideo(plan);
    console.log(`Rendered video: ${result.videoPath}`);
    console.log(`Rendered thumbnail: ${result.thumbnailPath}`);
    return;
  }

  if (command === 'longform') {
    const snapshot = await getFinanceSnapshot();
    const plan = await generateLongformVideoPlan(snapshot);
    const { clips, errors } = await downloadStockClips(plan);
    console.log(`Downloaded ${clips.length} stock clips for longform.`);
    if (errors.length) console.log(`Providers with errors: ${errors.join(' | ')}`);
    const result = await renderVideo(plan);
    console.log(`Rendered longform video: ${result.videoPath}`);
    console.log(`Rendered thumbnail: ${result.thumbnailPath}`);
    return;
  }

  if (command === 'documentary') {
    const snapshot = await getFinanceSnapshot();
    const plan = await generateDocumentaryLongformVideoPlan(snapshot);
    const result = await renderDocumentaryVideo(plan);
    console.log(`Rendered documentary longform video: ${result.videoPath}`);
    console.log(`Rendered documentary thumbnail: ${result.thumbnailPath}`);
    return;
  }

  if (command === 'documentary:v2') {
    const snapshot = await getFinanceSnapshot();
    const plan = await generateDocumentaryLongformVideoPlan(snapshot);
    const result = await renderIllustratedDocumentaryVideo(plan);
    console.log(`Rendered illustrated documentary longform video: ${result.videoPath}`);
    console.log(`Rendered illustrated documentary thumbnail: ${result.thumbnailPath}`);
    return;
  }

  if (command === 'panda:top-etfs') {
    const plan = generatePandaPopularEtfPlan();
    const result = await renderIllustratedDocumentaryVideo(plan);
    console.log(`Rendered panda ETF top 5 video: ${result.videoPath}`);
    console.log(`Rendered panda ETF top 5 thumbnail: ${result.thumbnailPath}`);
    return;
  }

  if (command === 'panda:prompts') {
    const plan = generatePandaPopularEtfPlan();
    const result = writeChatGptImagePromptPack(plan);
    console.log(`Wrote panda ETF ChatGPT image prompts: ${result.markdownPath}`);
    console.log(`Per-scene prompts: ${result.promptDir}`);
    console.log(`Save generated images here: ${result.sceneAssetDir}`);
    return;
  }

  if (command === 'browser-longform:render') {
    const planPath = path.join(outDir, 'browser-longform-plan.json');
    if (!existsSync(planPath)) throw new Error(`Missing ${planPath}. Run: npm run chatgpt:chrome-longform-script`);
    const plan = JSON.parse(readFileSync(planPath, 'utf8')).plan;
    const result = await renderIllustratedDocumentaryVideo(plan);
    console.log(`Rendered browser ChatGPT longform video: ${result.videoPath}`);
    console.log(`Rendered browser ChatGPT longform thumbnail: ${result.thumbnailPath}`);
    return;
  }

  if (command === 'image-prompts') {
    const snapshot = await getFinanceSnapshot();
    const plan = await generateDocumentaryLongformVideoPlan(snapshot);
    const result = writeChatGptImagePromptPack(plan);
    console.log(`Wrote ChatGPT image prompts: ${result.markdownPath}`);
    console.log(`Per-scene prompts: ${result.promptDir}`);
    console.log(`Save generated images here: ${result.sceneAssetDir}`);
    try {
      execFileSync('open', ['-a', 'ChatGPT'], { stdio: 'ignore' });
      execFileSync('open', [result.markdownPath], { stdio: 'ignore' });
      execFileSync('pbcopy', { input: readFileSync(result.scenePaths[0], 'utf8') });
      console.log('Opened ChatGPT and copied scene-01 prompt to clipboard.');
    } catch {
      console.log('Could not open ChatGPT automatically. Open the prompt markdown manually.');
    }
    return;
  }

  if (command === 'import:downloads') {
    const snapshot = await getFinanceSnapshot();
    const plan = await generateDocumentaryLongformVideoPlan(snapshot);
    const imported = await importLatestDownloadedImages(plan);
    imported.forEach((item, index) => console.log(`scene-${String(index + 1).padStart(2, '0')}: ${item.from} -> ${item.to}`));
    return;
  }

  if (command === 'stock') {
    const plan = await loadOrGeneratePlan();
    const { clips, errors } = await downloadStockClips(plan);
    console.log(`Downloaded ${clips.length} stock clips.`);
    if (errors.length) console.log(`Providers with errors: ${errors.join(' | ')}`);
    return;
  }

  if (command === 'shotstack') {
    const result = await submitShotstackRender();
    console.log(`Shotstack render submitted: ${result.response?.id || result.id || JSON.stringify(result)}`);
    return;
  }

  if (command === 'shotstack:status') {
    const renderId = process.argv[3];
    if (!renderId) throw new Error('Usage: node src/agent.mjs shotstack:status <renderId>');
    const result = await getShotstackRenderStatus(renderId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'upload') {
    const result = await uploadVideo();
    console.log(`Uploaded: https://www.youtube.com/watch?v=${result.id}`);
    return;
  }

  if (command === 'dry-run') {
    const snapshot = await getFinanceSnapshot();
    const plan = await generateVideoPlan(snapshot, { forceFallback: true });
    const result = await renderVideo(plan);
    console.log(`Dry-run complete: ${result.videoPath}`);
    return;
  }

  if (command === 'run') {
    const snapshot = await getFinanceSnapshot();
    const plan = await generateVideoPlan(snapshot);
    await downloadStockClips(plan);
    const renderResult = await renderVideo(plan);
    console.log(`Rendered video: ${renderResult.videoPath}`);
    console.log('Review the video before uploading. Then run: npm run upload');
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

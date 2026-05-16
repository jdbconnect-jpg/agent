import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { outDir } from './config.mjs';
import { getFinanceSnapshot } from './finance.mjs';
import { generateVideoPlan } from './scriptAgent.mjs';
import { renderVideo } from './media.mjs';
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

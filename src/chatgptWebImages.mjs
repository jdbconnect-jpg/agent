import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { outDir, rootDir } from './config.mjs';
import { getFinanceSnapshot } from './finance.mjs';
import { generateDocumentaryLongformVideoPlan, generatePandaPopularEtfPlan, popularEtfResearchSnapshot } from './scriptAgent.mjs';
import { writeChatGptImagePromptPack } from './illustratedMedia.mjs';

const profileDir = path.join(rootDir, '.chatgpt-browser-profile');
const targetDir = path.join(outDir, 'ai-scenes');
const pandaPlanPath = path.join(outDir, 'video-plan-panda-top-etfs.json');

function readPlanFile(planPath) {
  return JSON.parse(readFileSync(planPath, 'utf8')).plan;
}

function argValue(name, fallback = undefined) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function ensurePromptPack(planKind = 'documentary') {
  if (planKind === 'panda') {
    const plan = existsSync(pandaPlanPath) ? readPlanFile(pandaPlanPath) : generatePandaPopularEtfPlan();
    const pack = writeChatGptImagePromptPack(plan);
    return { plan, pack };
  }
  const snapshot = await getFinanceSnapshot();
  const plan = await generateDocumentaryLongformVideoPlan(snapshot);
  const pack = writeChatGptImagePromptPack(plan);
  return { plan, pack };
}

async function launchChatGpt() {
  if (process.env.CHATGPT_CDP_URL) {
    const browser = await chromium.connectOverCDP(process.env.CHATGPT_CDP_URL);
    let contexts = browser.contexts();
    if (contexts.length === 0) {
      const page = await browser.newPage();
      contexts = browser.contexts();
      return { context: contexts[0], close: () => page.close().catch(() => {}) };
    }
    const context = contexts[0];
    return { context, close: () => browser.close() };
  }
  mkdirSync(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: process.env.CHATGPT_BROWSER_CHANNEL || undefined,
    headless: false,
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  });
  return { context, close: () => context.close() };
}

async function waitForComposer(page) {
  const candidates = [
    'div[role="textbox"][aria-label*="ChatGPT"]',
    'div[role="textbox"][contenteditable="true"]',
    '[contenteditable="true"][data-testid="prompt-textarea"]',
    '#prompt-textarea',
    'textarea',
  ];
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    for (const selector of candidates) {
      const locator = page.locator(selector).last();
      if (await locator.count().catch(() => 0)) {
        if (await locator.isVisible().catch(() => false)) return locator;
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('ChatGPT composer was not found. Log in and open a new chat, then run again.');
}

async function isLoggedOut(page) {
  const loginPatterns = [/^로그인$/, /^Log in$/i, /^Login$/i, /무료로 회원 가입/, /^Sign up$/i];
  for (const pattern of loginPatterns) {
    const button = page.getByRole('button', { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) return true;
  }
  return page.locator('text=/You need to log in to ChatGPT|로그인해/').first().isVisible().catch(() => false);
}

async function waitForLoggedInComposer(page) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const composer = await waitForComposer(page).catch(() => null);
    if (composer && !(await isLoggedOut(page))) return composer;
    console.log('ChatGPT is not logged in yet. Please complete login in the browser window...');
    await page.waitForTimeout(3000);
  }
  throw new Error('ChatGPT is still logged out. Log in manually in the browser window, then run the command again.');
}

async function submitPrompt(page, prompt) {
  const composer = await waitForLoggedInComposer(page);
  await composer.click();
  await page.keyboard.press('Meta+A').catch(() => {});
  await page.keyboard.type(prompt, { delay: 1 });
  await page.keyboard.press('Enter');
}

async function countLargeImages(page) {
  return page.evaluate(() => Array.from(document.images)
    .filter((img) => img.naturalWidth >= 512 && img.naturalHeight >= 512)
    .length);
}

async function waitForNewLargeImage(page, previousCount) {
  const deadline = Date.now() + 360_000;
  while (Date.now() < deadline) {
    const data = await page.evaluate(async (previous) => {
      const images = Array.from(document.images)
        .filter((img) => img.naturalWidth >= 512 && img.naturalHeight >= 512)
        .map((img) => ({
          src: img.currentSrc || img.src,
          width: img.naturalWidth,
          height: img.naturalHeight,
        }));
      if (images.length <= previous) return null;
      const picked = images.at(-1);
      try {
        const response = await fetch(picked.src);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return { ...picked, base64 };
      } catch {
        return { ...picked, base64: null };
      }
    }, previousCount);

    if (data?.base64) return data;
    await page.waitForTimeout(2500);
  }
  throw new Error('Timed out waiting for ChatGPT to generate a downloadable large image.');
}

async function waitForAssistantText(page) {
  const deadline = Date.now() + 240_000;
  let last = '';
  let stableTicks = 0;
  while (Date.now() < deadline) {
    const text = await page.evaluate(() => {
      const messages = Array.from(document.querySelectorAll('[data-message-author-role="assistant"], article, main div.markdown'));
      const visible = messages
        .map((node) => node.innerText || '')
        .filter((value) => value.trim().length > 80);
      return visible.at(-1) || document.body.innerText || '';
    });
    if (text.trim() === last.trim() && text.trim().length > 300) {
      stableTicks += 1;
      if (stableTicks >= 4) return text;
    } else {
      stableTicks = 0;
      last = text;
    }
    await page.waitForTimeout(2500);
  }
  throw new Error('Timed out waiting for ChatGPT script response.');
}

function extractJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(raw);
}

function normalizePandaPlan(plan) {
  const fallback = generatePandaPopularEtfPlan({ source: 'chatgpt-browser-fallback-normalizer' });
  return {
    ...fallback,
    ...plan,
    ticker: plan.ticker || 'ETF TOP 5',
    format: 'panda-documentary',
    aspect: '16:9',
    character: {
      ...fallback.character,
      ...(plan.character || {}),
      consistencyPrompt: plan.character?.consistencyPrompt || fallback.character.consistencyPrompt,
    },
    research: popularEtfResearchSnapshot,
    generatedBy: 'chatgpt-browser',
    scenes: Array.isArray(plan.scenes) && plan.scenes.length >= 6 ? plan.scenes.map((scene, index) => ({
      title: scene.title || fallback.scenes[index]?.title || `장면 ${index + 1}`,
      subtitle: scene.subtitle || fallback.scenes[index]?.subtitle || '핵심만 보기',
      narration: scene.narration || fallback.scenes[index]?.narration || '',
      durationSec: Math.min(30, Math.max(22, Number(scene.durationSec || fallback.scenes[index]?.durationSec || 25))),
      visual: scene.visual || fallback.scenes[index]?.visual || `panda_scene_${index + 1}`,
    })) : fallback.scenes,
  };
}

function pandaScriptPrompt() {
  return [
    '너는 한국어 금융 유튜브 롱폼 작가이자 영상 기획자다.',
    '아래 리서치 기준으로 3분~4분짜리 영상 대본 JSON을 만들어라.',
    '주제: "요즘 가장 최근 인기 있는 ETF TOP 5, 그냥 따라 사면 위험한 이유".',
    '목표: 사람들이 혹하는 질문 → 순위 공개 → 각 ETF의 인기 이유 → 반전/리스크 → 짧은 결론.',
    '톤: 쉽고 궁금하게, 과장 없이, 투자 권유 금지.',
    '캐릭터: 팬더 선생. 모든 씬 이미지에서 같은 캐릭터로 유지해야 한다.',
    '팬더 선생 고정 묘사: small round cute panda teacher, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression.',
    `리서치: ${JSON.stringify(popularEtfResearchSnapshot)}`,
    '반드시 JSON 객체만 출력해라. 마크다운, 설명, 코드블록 금지.',
    'JSON 필드: ticker, title, description, tags, thumbnailText, disclosure, format, aspect, character, scenes.',
    'format은 "panda-documentary", aspect는 "16:9".',
    'scenes는 8개. 각 scene 필드: title, subtitle, narration, durationSec, visual.',
    '각 durationSec는 22~30초 사이로 고르게 배분.',
    'visual은 panda_hook, panda_cash, panda_crypto, panda_ai, panda_index, panda_winner, panda_warning, panda_close 중 하나.',
    '자막 title/subtitle은 짧고 강하게. narration은 한국어 구어체로, 한 씬당 2~4문장.',
  ].join('\n');
}

async function generatePandaScriptWithChatGpt(page) {
  await waitForLoggedInComposer(page);
  await submitPrompt(page, pandaScriptPrompt());
  const text = await waitForAssistantText(page);
  const plan = normalizePandaPlan(extractJsonObject(text));
  writeFileSync(pandaPlanPath, JSON.stringify({ plan }, null, 2));
  writeFileSync(path.join(outDir, 'video-plan.json'), JSON.stringify({ plan }, null, 2));
  console.log(`Saved ChatGPT panda ETF script plan: ${pandaPlanPath}`);
  return plan;
}

async function saveSceneImage(imageData, targetPath) {
  await sharp(Buffer.from(imageData.base64, 'base64'))
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .png()
    .toFile(targetPath);
}

async function main() {
  const mode = process.argv[2] || 'run';
  const planKind = argValue('--plan', mode.startsWith('panda') ? 'panda' : 'documentary');

  const browserSession = await launchChatGpt();
  const { context } = browserSession;
  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });

  if (mode === 'panda-script') {
    await generatePandaScriptWithChatGpt(page);
    await browserSession.close();
    console.log('Next: npm run chatgpt:panda-images -- --force');
    return;
  }

  const { plan, pack } = await ensurePromptPack(planKind);
  mkdirSync(pack.sceneAssetDir || targetDir, { recursive: true });

  if (mode === 'login') {
    console.log('Chrome opened. Log in to ChatGPT in this browser. This command will finish when the prompt box is ready.');
    await waitForLoggedInComposer(page);
    await browserSession.close();
    console.log('ChatGPT login/session is ready. Next: npm run chatgpt:images');
    return;
  }

  await waitForLoggedInComposer(page);
  console.log('ChatGPT composer ready.');

  const start = Number(argValue('--start', '1'));
  const end = Number(argValue('--end', String(plan.scenes.length)));

  for (let sceneNumber = start; sceneNumber <= end; sceneNumber += 1) {
    const promptPath = path.join(pack.promptDir, `scene-${String(sceneNumber).padStart(2, '0')}.txt`);
    const targetPath = path.join(pack.sceneAssetDir || targetDir, `scene-${String(sceneNumber).padStart(2, '0')}.png`);
    if (existsSync(targetPath) && !process.argv.includes('--force')) {
      console.log(`Skipping existing ${targetPath}`);
      continue;
    }

    const previousCount = await countLargeImages(page);
    const prompt = readFileSync(promptPath, 'utf8');
    console.log(`Submitting scene ${sceneNumber}/${plan.scenes.length}: ${plan.scenes[sceneNumber - 1].title}`);
    await submitPrompt(page, prompt);
    const imageData = await waitForNewLargeImage(page, previousCount);
    await saveSceneImage(imageData, targetPath);
    console.log(`Saved ${targetPath}`);
  }

  await browserSession.close();
  console.log('Done. Next: npm run longform:illustrated');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

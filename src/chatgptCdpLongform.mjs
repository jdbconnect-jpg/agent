import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { outDir, rootDir } from './config.mjs';
import { renderIllustratedDocumentaryVideo, scenePrompt, writeChatGptImagePromptPack } from './illustratedMedia.mjs';
import { renderMatchedLongformVideo } from './alignedLongformMedia.mjs';

const cdpUrl = process.env.CHATGPT_CDP_URL || 'http://127.0.0.1:9222';
const planPath = path.join(outDir, 'browser-longform-plan.json');
const profileDir = path.join(rootDir, '.chatgpt-chrome-cdp-profile');

function argValue(name, fallback = undefined) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52) || 'chatgpt-longform';
}

async function ensureChrome() {
  try {
    const res = await fetch(`${cdpUrl}/json/version`);
    if (res.ok) return;
  } catch {
    // Launch below.
  }

  mkdirSync(profileDir, { recursive: true });
  execFileSync('open', [
    '-na',
    'Google Chrome',
    '--args',
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    'https://chatgpt.com/',
  ], { stdio: 'ignore' });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${cdpUrl}/json/version`);
      if (res.ok) return;
    } catch {
      // keep waiting
    }
    await sleep(750);
  }
  throw new Error('Chrome remote debugging did not start on http://127.0.0.1:9222.');
}

async function getChatGptTab() {
  await ensureChrome();
  let tabs = await fetch(`${cdpUrl}/json/list`).then((res) => res.json());
  let tab = tabs.find((item) => item.url?.includes('chatgpt.com') && item.type === 'page');
  if (!tab) {
    await fetch(`${cdpUrl}/json/new?${encodeURIComponent('https://chatgpt.com/')}`).catch(() => null);
    await sleep(1500);
    tabs = await fetch(`${cdpUrl}/json/list`).then((res) => res.json());
    tab = tabs.find((item) => item.url?.includes('chatgpt.com') && item.type === 'page');
  }
  if (!tab?.webSocketDebuggerUrl) throw new Error('Could not find or open a ChatGPT tab in Chrome.');
  return tab;
}

async function connectCdp() {
  const tab = await getChatGptTab();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}${msg.error.data ? `: ${msg.error.data}` : ''}`));
      else resolve(msg.result);
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable').catch(() => {});
  await send('Input.enable').catch(() => {});
  await send('Page.bringToFront').catch(() => {});
  return { send, close: () => ws.close() };
}

async function evaluate(cdp, expression, { awaitPromise = false } = {}) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed.');
  }
  return result.result?.value;
}

async function focusComposer(cdp) {
  return evaluate(cdp, `(() => {
    const selectors = [
      '[data-testid="prompt-textarea"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea'
    ];
    const el = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter((node) => node.offsetParent !== null)
      .at(-1);
    if (!el) return { ok: false, loggedOut: /로그인|Log in|Sign up|무료로 회원/.test(document.body.innerText || '') };
    el.focus();
    if (el.tagName === 'TEXTAREA') el.value = '';
    else el.textContent = '';
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    return { ok: true, loggedOut: false };
  })()`);
}

async function waitForComposer(cdp) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const status = await focusComposer(cdp).catch(() => ({ ok: false }));
    if (status?.ok) return;
    if (status?.loggedOut) console.log('ChatGPT login is needed. Please complete login in the opened Chrome window...');
    await sleep(2500);
  }
  throw new Error('ChatGPT composer was not found. Log in manually and open a new chat, then run again.');
}

async function openImageGeneratorGpt(cdp) {
  if (process.argv.includes('--same-chat')) return;
  console.log('Opening ChatGPT image generator GPT for scene images...');
  await cdp.send('Page.navigate', { url: 'https://chatgpt.com/g/g-pmuQfob8d-image-generator' }).catch(() => {});
  await sleep(3500);
  await waitForComposer(cdp);
  await waitForImageCountStable(cdp).catch(() => {});
}

async function submitPrompt(cdp, prompt) {
  await waitForComposer(cdp);
  await cdp.send('Input.insertText', { text: prompt });
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-testid="send-button"]');
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    button.click();
    return true;
  })()`).catch(() => false);
  if (clicked) {
    await sleep(700);
    const responding = await evaluate(cdp, `!!document.querySelector('[data-testid="stop-button"]')`).catch(() => false);
    if (responding) return;
  }
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Meta',
    code: 'MetaLeft',
    windowsVirtualKeyCode: 91,
    nativeVirtualKeyCode: 55,
    modifiers: 4,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 36,
    modifiers: 4,
    text: '\r',
    unmodifiedText: '\r',
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 36,
    modifiers: 4,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Meta',
    code: 'MetaLeft',
    windowsVirtualKeyCode: 91,
    nativeVirtualKeyCode: 55,
  });
  await sleep(700);
  const responding = await evaluate(cdp, `!!document.querySelector('[data-testid="stop-button"]')`).catch(() => false);
  if (responding) return;
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
    macCharCode: 13,
    unmodifiedText: '\r',
    text: '\r',
    key: 'Enter',
    code: 'Enter',
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
    key: 'Enter',
    code: 'Enter',
  });
}

async function waitForAssistantText(cdp, { minLength = 900 } = {}) {
  const deadline = Date.now() + 360_000;
  let last = '';
  let stableTicks = 0;
  while (Date.now() < deadline) {
    const text = await evaluate(cdp, `(() => {
      const nodes = Array.from(document.querySelectorAll('[data-message-author-role="assistant"], article, main .markdown, main [data-testid]'));
      const values = nodes.map((node) => node.innerText || '').filter((value) => value.trim().length > 80);
      return values.at(-1) || '';
    })()`).catch(() => '');

    if (text.trim().length >= minLength && text.trim() === last.trim()) {
      stableTicks += 1;
      if (stableTicks >= 5) return text;
    } else {
      stableTicks = 0;
      last = text;
    }
    await sleep(2500);
  }
  throw new Error('Timed out waiting for ChatGPT response text.');
}

function extractJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  if (!raw.trim().startsWith('{')) throw new Error('ChatGPT response did not contain a JSON object.');
  return JSON.parse(raw);
}

function normalizePlan(plan, topic) {
  const slug = slugify(plan.slug || topic);
  const scenes = Array.isArray(plan.scenes) ? plan.scenes.slice(0, 10).map((scene, index) => ({
    title: String(scene.title || `장면 ${index + 1}`).slice(0, 28),
    subtitle: String(scene.subtitle || '핵심만 보기').slice(0, 38),
    narration: String(scene.narration || '').trim(),
    durationSec: Math.min(36, Math.max(20, Number(scene.durationSec || 28))),
    visual: scene.visual || `browser_scene_${index + 1}`,
    imagePrompt: String(scene.imagePrompt || '').trim(),
  })) : [];

  if (scenes.length < 7) throw new Error('ChatGPT plan needs at least 7 scenes for a 3-5 minute longform video.');
  const character = plan.character || {
    name: '팬더 선생',
    consistencyPrompt: 'same cute panda teacher character in every scene: small round panda, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression',
  };

  const normalized = {
    ticker: plan.ticker || 'ETF TOP 5',
    slug,
    title: plan.title || topic,
    description: plan.description || 'ChatGPT 브라우저 자동화로 만든 롱폼 ETF 설명 영상입니다. 투자 권유가 아닌 정보 제공용 콘텐츠입니다.',
    tags: Array.isArray(plan.tags) ? plan.tags : ['ETF', '미국ETF', '재테크', '투자공부'],
    thumbnailText: Array.isArray(plan.thumbnailText) ? plan.thumbnailText.slice(0, 3) : ['ETF TOP 5', '요즘 돈 몰리는 곳', '따라 사면 위험?'],
    disclosure: plan.disclosure || '이 영상은 AI 음성과 자동 생성 이미지를 포함하며 투자 권유가 아닙니다.',
    format: 'browser-longform',
    aspect: '16:9',
    outputBase: plan.outputBase || `${slug}-chatgpt-longform`,
    thumbnailFile: plan.thumbnailFile || `thumbnail-${slug}.jpg`,
    assetDir: plan.assetDir || path.join('out', `ai-scenes-${slug}`),
    generatedBy: 'chatgpt-browser-cdp',
    character,
    research: plan.research || {},
    scenes: scenes.map((scene, index) => ({
      ...scene,
      imagePrompt: scene.imagePrompt || [
        'Create one polished Korean YouTube finance documentary illustration.',
        `Recurring character: ${character.consistencyPrompt || character.name || 'same cute panda teacher'}.`,
        `Scene ${index + 1}: ${scene.title} / ${scene.subtitle}.`,
        `Narrative cue: ${scene.narration}`,
      ].join('\n'),
    })),
  };

  const total = normalized.scenes.reduce((sum, scene) => sum + scene.durationSec, 0);
  if (total < 180) {
    const add = Math.ceil((180 - total) / normalized.scenes.length);
    normalized.scenes = normalized.scenes.map((scene) => ({ ...scene, durationSec: Math.min(36, scene.durationSec + add) }));
  }
  return normalized;
}

function scriptPrompt(topic) {
  return [
    '너는 한국어 금융 유튜브 롱폼 작가, 다큐형 스토리보드 감독, 이미지 프롬프트 디렉터다.',
    '브라우저에서 바로 제작에 쓸 수 있는 JSON만 출력해라. 마크다운, 설명, 코드블록은 금지한다.',
    '',
    `영상 주제: ${topic}`,
    '영상 길이: 3분~5분. 씬 수: 8~10개. 각 씬은 20~36초.',
    '목표: 사람이 계속 보게 만드는 질문 → 갈등/반전 → TOP 5 공개 → 각 ETF의 인기 이유와 함정 → 결론.',
    '중요: 같은 패턴에 텍스트만 바꾸는 느낌 금지. 각 씬마다 이미지 구성이 달라야 한다.',
    '중요: 대본과 이미지가 반드시 같은 이야기를 해야 한다. narration에서 말하는 핵심 사물/상황이 imagePrompt에도 그대로 보여야 한다.',
    '캐릭터: 팬더 선생을 진행자로 사용한다. 모든 이미지 프롬프트에서 동일 캐릭터가 유지되게 써라.',
    '팬더 선생 고정 묘사: small round cute panda teacher, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression.',
    '',
    '2026년 5월 17일 기준 참고 리서치:',
    '- U.S. ETF inflows topped $700B through May 13, 2026.',
    '- SPY and VOO both had roughly $16B+ inflows during Apr 12-May 12, 2026.',
    '- May 5, 2026 daily flows had VOO, SGOV, and IWM among top creations; QQQ had notable redemption that day.',
    '- Large attention names include VOO, SPY, QQQ, IBIT, SGOV, and sometimes IWM/XLE/DRAM depending on angle.',
    '이 리서치는 투자 추천이 아니라 콘텐츠 주제 선정용이다.',
    '',
    'JSON 필드:',
    'ticker, slug, title, description, tags, thumbnailText, disclosure, format, aspect, character, research, scenes.',
    'format은 "browser-longform", aspect는 "16:9".',
    'scenes 각 필드: title, subtitle, narration, durationSec, visual, imagePrompt, screenFocus, viewerCuriosity.',
    'screenFocus는 이 씬에서 이미지에 반드시 보여야 하는 요소 1문장이다.',
    'viewerCuriosity는 시청자가 다음 장면을 궁금해할 이유 1문장이다.',
    '',
    'imagePrompt 작성 규칙:',
    '- 각 씬에 맞는 16:9 고퀄리티 다큐형 일러스트 한 장을 생성하게 써라.',
    '- 팬더 선생 외형을 매번 똑같이 반복해서 넣어라.',
    '- 이미지 안에는 읽을 수 있는 글자, 숫자, 티커, 로고, 워터마크, UI 화면을 넣지 말라고 명시해라.',
    '- 한국어 자막과 타이틀이 올라갈 하단 38%는 단순하고 정돈된 여백으로 두라고 명시해라.',
    '- 각 씬의 배경/소품/감정/카메라 구도를 서로 다르게 써라.',
    '- 복잡한 표, 작은 글자, 숫자 패널, 깨지는 그래픽을 금지해라. 큰 상징 1~2개와 팬더 선생만 중심에 둬라.',
    '- 카메라 움직임이 거의 없어도 어색하지 않도록 구도를 안정적으로 써라.',
    '',
    '대본 톤:',
    '- 한국어 구어체.',
    '- 수익 보장, 매수 추천, 확정 표현 금지.',
    '- 사람들이 혹할 만한 제목이어도 결론은 리스크와 자기 목적 확인으로 끝낸다.',
  ].join('\n');
}

async function generateScript(cdp) {
  const topic = argValue('--topic', '요즘 가장 최근 인기 있는 ETF TOP 5, 그냥 따라 사면 위험한 이유');
  console.log(`Asking ChatGPT for longform script/storyboard: ${topic}`);
  await submitPrompt(cdp, scriptPrompt(topic));
  const text = await waitForAssistantText(cdp);
  const plan = normalizePlan(extractJsonObject(text), topic);
  mkdirSync(path.dirname(planPath), { recursive: true });
  writeFileSync(planPath, JSON.stringify({ plan }, null, 2));
  writeFileSync(path.join(outDir, 'video-plan.json'), JSON.stringify({ plan }, null, 2));
  writeChatGptImagePromptPack(plan);
  console.log(`Saved browser longform plan: ${planPath}`);
  return plan;
}

function loadPlan() {
  if (!existsSync(planPath)) throw new Error(`Missing ${planPath}. Run: npm run chatgpt:chrome-longform-script`);
  return JSON.parse(readFileSync(planPath, 'utf8')).plan;
}

async function countLargeImages(cdp) {
  return (await largeImageSources(cdp)).length;
}

async function largeImageSources(cdp) {
  return evaluate(cdp, `Array.from(document.images).filter((img) => {
    const src = img.currentSrc || img.src || '';
    const alt = img.alt || '';
    return img.naturalWidth >= 512 && img.naturalHeight >= 512 && !/GPT Icon|gizmo_id=g-pmuQfob8d/.test(alt + src);
  }).map((img) => img.currentSrc || img.src)`);
}

async function waitForImageCountStable(cdp) {
  let last = -1;
  let stableTicks = 0;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const count = await countLargeImages(cdp).catch(() => 0);
    if (count === last) {
      stableTicks += 1;
      if (stableTicks >= 3) return count;
    } else {
      stableTicks = 0;
      last = count;
    }
    await sleep(750);
  }
  return last;
}

async function waitForNewLargeImage(cdp, previousSources = []) {
  const deadline = Date.now() + 480_000;
  const previous = new Set(previousSources);
  while (Date.now() < deadline) {
    const data = await evaluate(cdp, `(async () => {
      const images = Array.from(document.images)
        .filter((img) => {
          const src = img.currentSrc || img.src || '';
          const alt = img.alt || '';
          return img.naturalWidth >= 512 && img.naturalHeight >= 512 && !/GPT Icon|gizmo_id=g-pmuQfob8d/.test(alt + src);
        })
        .map((img) => ({ src: img.currentSrc || img.src, alt: img.alt || '', width: img.naturalWidth, height: img.naturalHeight }));
      const previous = new Set(${JSON.stringify(previousSources)});
      const fresh = images.filter((img) => !previous.has(img.src));
      const picked = fresh.at(-1) || (!document.querySelector('[data-testid="stop-button"]') ? images.at(-1) : null);
      if (!picked) return null;
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
        return null;
      }
    })()`, { awaitPromise: true }).catch(() => null);
    if (data?.base64) return data;
    await sleep(3000);
  }
  throw new Error('Timed out waiting for a new ChatGPT image.');
}

async function saveSceneImage(imageData, targetPath) {
  await sharp(Buffer.from(imageData.base64, 'base64'))
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .png()
    .toFile(targetPath);
}

async function generateImages(cdp, plan) {
  await openImageGeneratorGpt(cdp);
  const sceneAssetDir = path.isAbsolute(plan.assetDir) ? plan.assetDir : path.join(rootDir, plan.assetDir);
  mkdirSync(sceneAssetDir, { recursive: true });
  const start = Number(argValue('--start', '1'));
  const end = Number(argValue('--end', String(plan.scenes.length)));
  const force = process.argv.includes('--force');

  for (let sceneNumber = start; sceneNumber <= end; sceneNumber += 1) {
    const scene = plan.scenes[sceneNumber - 1];
    const targetPath = path.join(sceneAssetDir, `scene-${String(sceneNumber).padStart(2, '0')}.png`);
    if (existsSync(targetPath) && !force) {
      console.log(`Skipping existing scene image: ${targetPath}`);
      continue;
    }

    const prompt = [
      `Generate one image now. You must use the image generation tool. Scene ${sceneNumber}/${plan.scenes.length}.`,
      '',
      scene.imagePrompt || scenePrompt(scene, plan, sceneNumber - 1),
    ].join('\n');

    const previousSources = await largeImageSources(cdp).catch(() => []);
    console.log(`Asking ChatGPT for scene ${sceneNumber}/${plan.scenes.length}: ${scene.title}`);
    await submitPrompt(cdp, prompt);
    const imageData = await waitForNewLargeImage(cdp, previousSources);
    await saveSceneImage(imageData, targetPath);
    console.log(`Saved scene image: ${targetPath}`);
  }
}

async function renderPlan(plan) {
  const matched = process.argv.includes('--matched') || process.argv.includes('--sync');
  const result = matched
    ? await renderMatchedLongformVideo(plan)
    : await renderIllustratedDocumentaryVideo(plan);
  console.log(`Rendered video: ${result.videoPath}`);
  console.log(`Rendered thumbnail: ${result.thumbnailPath}`);
}

async function main() {
  const mode = process.argv[2] || 'all';
  const needsBrowser = ['script', 'images', 'all'].includes(mode);
  const cdp = needsBrowser ? await connectCdp() : null;
  try {
    if (mode === 'script') {
      await generateScript(cdp);
      console.log('Next: npm run chatgpt:chrome-longform-images -- --force');
      return;
    }
    if (mode === 'images') {
      await generateImages(cdp, loadPlan());
      console.log('Next: npm run longform:browser-render');
      return;
    }
    if (mode === 'render') {
      await renderPlan(loadPlan());
      return;
    }
    if (mode === 'all') {
      const plan = await generateScript(cdp);
      await generateImages(cdp, plan);
      if (!process.argv.includes('--skip-render')) await renderPlan(plan);
      return;
    }
    throw new Error(`Unknown mode: ${mode}`);
  } finally {
    cdp?.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

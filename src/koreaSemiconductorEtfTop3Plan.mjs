import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config, outDir, rootDir } from './config.mjs';
import { renderMatchedLongformVideo } from './alignedLongformMedia.mjs';

const W = 1280;
const H = 720;
const slug = 'korea-semiconductor-etf-top3-panda';
const assetDir = path.join(outDir, `ai-scenes-${slug}`);

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function chipPattern() {
  const pins = Array.from({ length: 9 }, (_, i) => {
    const x = 470 + i * 38;
    return `<rect x="${x}" y="176" width="18" height="50" rx="5"/><rect x="${x}" y="494" width="18" height="50" rx="5"/>`;
  }).join('');
  const sidePins = Array.from({ length: 7 }, (_, i) => {
    const y = 240 + i * 36;
    return `<rect x="384" y="${y}" width="50" height="18" rx="5"/><rect x="846" y="${y}" width="50" height="18" rx="5"/>`;
  }).join('');
  return `<g fill="#ffe200" opacity=".22">${pins}${sidePins}</g>`;
}

function panda(x = 920, y = 250, scale = 1) {
  return `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="124" rx="106" ry="118" fill="#f2ead8"/>
    <circle cx="-58" cy="14" r="36" fill="#151515"/>
    <circle cx="58" cy="14" r="36" fill="#151515"/>
    <circle cx="0" cy="54" r="82" fill="#fff4df"/>
    <ellipse cx="-32" cy="48" rx="26" ry="34" fill="#171717"/>
    <ellipse cx="32" cy="48" rx="26" ry="34" fill="#171717"/>
    <circle cx="-32" cy="48" r="18" fill="none" stroke="#111" stroke-width="8"/>
    <circle cx="32" cy="48" r="18" fill="none" stroke="#111" stroke-width="8"/>
    <line x1="-14" y1="48" x2="14" y2="48" stroke="#111" stroke-width="7"/>
    <circle cx="-26" cy="42" r="6" fill="#fff"/>
    <circle cx="38" cy="42" r="6" fill="#fff"/>
    <ellipse cx="0" cy="76" rx="13" ry="10" fill="#171717"/>
    <path d="M-15 91 Q0 104 15 91" fill="none" stroke="#171717" stroke-width="5" stroke-linecap="round"/>
    <path d="M-82 148 L82 148 L92 256 L-92 256 Z" fill="#b59b76"/>
    <path d="M-30 158 L0 182 L30 158 L30 198 L0 176 L-30 198 Z" fill="#71d9b0"/>
    <line x1="-92" y1="186" x2="-154" y2="132" stroke="#111" stroke-width="20" stroke-linecap="round"/>
    <line x1="92" y1="190" x2="150" y2="130" stroke="#111" stroke-width="20" stroke-linecap="round"/>
    <line x1="128" y1="126" x2="220" y2="74" stroke="#d8a84c" stroke-width="7" stroke-linecap="round"/>
  </g>`;
}

function character(x, y, scale = 1, mood = 'thinking') {
  const brow = mood === 'worried' ? 'M-30 36 L-7 46 M30 36 L7 46' : 'M-32 38 Q-20 32 -8 38 M32 38 Q20 32 8 38';
  return `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="125" rx="82" ry="116" fill="#253246"/>
    <circle cx="0" cy="42" r="62" fill="#ffd7ae"/>
    <path d="M-52 24 Q-20 -30 48 12 Q18 -4 -2 14 Q-22 34 -52 24Z" fill="#15171c"/>
    <path d="${brow}" fill="none" stroke="#1b1b1b" stroke-width="6" stroke-linecap="round"/>
    <circle cx="-22" cy="48" r="6" fill="#1b1b1b"/>
    <circle cx="22" cy="48" r="6" fill="#1b1b1b"/>
    <path d="M-15 76 Q0 88 15 76" fill="none" stroke="#1b1b1b" stroke-width="5" stroke-linecap="round"/>
    <line x1="-55" y1="124" x2="-105" y2="176" stroke="#ffd7ae" stroke-width="18" stroke-linecap="round"/>
    <line x1="55" y1="124" x2="102" y2="170" stroke="#ffd7ae" stroke-width="18" stroke-linecap="round"/>
  </g>`;
}

function sceneImageSvg(scene, index) {
  const accent = scene.accent || '#ffe200';
  const showPanda = scene.panda !== false;
  const showPeople = scene.people !== false;
  const chipX = index % 2 ? 660 : 455;
  const bg2 = index % 3 === 0 ? '#101a2b' : index % 3 === 1 ? '#12120c' : '#111421';
  const curve = `M86 ${260 + (index % 4) * 24} C210 ${160 + index * 3}, 350 ${330 - index * 2}, 510 220 S820 120, 1120 ${210 + (index % 5) * 26}`;
  const rain = index % 5 === 2;
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#071018"/>
        <stop offset=".48" stop-color="${bg2}"/>
        <stop offset="1" stop-color="#030406"/>
      </linearGradient>
      <radialGradient id="glow" cx="${index % 2 ? '72%' : '32%'}" cy="24%" r="60%">
        <stop offset="0" stop-color="${accent}" stop-opacity=".28"/>
        <stop offset=".5" stop-color="${accent}" stop-opacity=".08"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="calm" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset=".58" stop-color="#000" stop-opacity=".04"/>
        <stop offset="1" stop-color="#000" stop-opacity=".58"/>
      </linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <g opacity=".18" stroke="#fff" stroke-width="2">
      ${Array.from({ length: 9 }, (_, i) => `<line x1="${105 + i * 128}" y1="92" x2="${105 + i * 128}" y2="458"/>`).join('')}
      ${Array.from({ length: 5 }, (_, i) => `<line x1="80" y1="${110 + i * 78}" x2="1170" y2="${110 + i * 78}"/>`).join('')}
    </g>
    <path d="${curve}" fill="none" stroke="${accent}" stroke-width="13" stroke-linecap="round" opacity=".82"/>
    <g transform="translate(${chipX} 205)" fill="none" stroke="${accent}" stroke-width="8" opacity=".88">
      <rect x="-95" y="-68" width="190" height="136" rx="18" fill="#101820" stroke="${accent}"/>
      <path d="M-45 -18 H45 M-45 18 H45 M-18 -45 V45 M18 -45 V45"/>
    </g>
    ${chipPattern()}
    <g opacity=".30" filter="url(#soft)">
      <circle cx="${index % 2 ? 965 : 300}" cy="230" r="100" fill="${accent}"/>
      <circle cx="${index % 2 ? 1038 : 226}" cy="330" r="48" fill="#ffffff"/>
    </g>
    ${rain ? '<path d="M110 120 C250 220 360 150 510 260 S790 380 1070 230" fill="none" stroke="#ff4f67" stroke-width="10" opacity=".7"/>' : ''}
    ${showPeople ? character(index % 2 ? 160 : 225, 255, .88, rain ? 'worried' : 'thinking') : ''}
    ${showPanda ? panda(index % 2 ? 920 : 875, index % 4 === 0 ? 205 : 230, .78) : ''}
    <rect width="${W}" height="${H}" fill="url(#calm)"/>
  </svg>`;
}

function thumbnailSvg(plan, scenePath) {
  const href = `data:image/png;base64,${readFileSync(scenePath).toString('base64')}`;
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="left" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#05080d" stop-opacity=".94"/>
        <stop offset=".56" stop-color="#05080d" stop-opacity=".70"/>
        <stop offset="1" stop-color="#05080d" stop-opacity=".08"/>
      </linearGradient>
      <filter id="shadow" x="-35%" y="-35%" width="180%" height="180%">
        <feDropShadow dx="9" dy="10" stdDeviation="0" flood-color="#000" flood-opacity=".98"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .top { font-size: 54px; fill: #050505; }
      .main { font-size: 142px; fill: #ffe200; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 9px; }
      .red { font-size: 95px; fill: #ff4665; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 8px; }
      .bubble { font-size: 44px; fill: #fff; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 5px; }
    </style>
    <image href="${href}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
    <rect width="${W}" height="${H}" fill="url(#left)"/>
    <rect x="52" y="42" width="545" height="88" rx="12" fill="#ffe200"/>
    <text x="324" y="104" class="top" text-anchor="middle">국내 반도체 ETF</text>
    <text x="58" y="286" class="main">대장 TOP 3</text>
    <text x="62" y="444" class="main">처음이면</text>
    <text x="70" y="612" class="red">이 3개만</text>
    <g transform="translate(822,68) rotate(7)">
      <rect x="0" y="0" width="328" height="96" rx="14" fill="#ff3150"/>
      <text x="164" y="66" class="bubble" text-anchor="middle">따라사기 전!</text>
    </g>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#050505" stroke-width="14"/>
  </svg>`;
}

export function buildKoreaSemiconductorEtfTop3Plan() {
  const character = 'same recurring cute panda teacher, round panda, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression, soft 3D animated Korean finance teacher style';
  const baseRules = [
    'Create a polished 16:9 Korean finance documentary illustration.',
    'Cute animation style, not photorealistic. Friendly rounded Korean beginner investor characters and symbolic semiconductor visuals.',
    `When the panda appears, keep this exact character: ${character}.`,
    'Do not include readable text, letters, numbers, logos, watermarks, UI screenshots, or ETF tickers inside the image.',
    'Keep the lower 38 percent calm and darker for one-line Korean captions.',
  ].join(' ');

  const scenes = [
    ['AI 실적은 좋은데', '왜 반도체 ETF는 갈릴까?', '#ffe200', true, true, 'AI 실적은 뜨겁습니다. 그런데 ETF는 다 같이 오르지 않습니다.', 'A cute Korean investor sees glowing AI chip lights and different ETF baskets moving in different directions, panda teacher in the background.'],
    ['오늘의 질문', '대장 ETF 3개만 고르면?', '#ffcf48', true, true, '오늘 질문은 단순합니다. 국내 반도체 ETF, 뭐부터 봐야 할까요?', 'A clean classroom desk with three glowing chip baskets, a curious beginner and panda teacher looking at them.'],
    ['첫 번째 반전', '반도체 ETF도 종류가 다르다', '#63e7ff', false, true, '반도체 ETF라고 다 같은 상품이 아닙니다. 담는 기업과 비중이 다릅니다.', 'Three cute animated baskets: memory chip basket, broad semicon basket, AI equipment basket, no text.'],
    ['선정 기준', '크기보다 구조를 본다', '#7cffb2', true, false, '이번 순위는 매수 추천이 아닙니다. 순자산, 대표성, 구조를 함께 봅니다.', 'Panda teacher points at three blank criteria cards with icons for size, structure, risk.'],
    ['3위', 'KODEX 반도체', '#ffe200', false, true, '3위는 KODEX 반도체입니다. 국내 반도체 밸류체인을 넓게 봅니다.', 'Cute animated semiconductor factory and many small component baskets connected by glowing lines.'],
    ['KODEX의 장점', '한 종목보다 넓다', '#31e87a', true, true, '삼성전자와 SK하이닉스만 보는 상품은 아닙니다. 소재와 장비 기업도 함께 봅니다.', 'Panda teacher shows a broad semiconductor supply chain map made of cute icons, no letters.'],
    ['하지만 주의', '섹터 ETF라 흔들린다', '#ff4f67', false, true, '하지만 섹터 ETF입니다. 반도체 사이클이 꺾이면 같이 흔들립니다.', 'Rainy chip market scene, animated investor holding a basket while a red curve drops softly.'],
    ['2위', 'KODEX AI반도체핵심장비', '#63e7ff', true, false, '2위는 AI 반도체 핵심장비입니다. AI 수요의 뒤쪽을 보는 상품입니다.', 'Panda teacher beside glowing chip-making machines and small equipment icons, cute 3D animation style.'],
    ['장비 ETF의 매력', 'AI 투자 뒤의 삽과 곡괭이', '#ffcf48', false, true, 'AI가 커질수록 장비가 필요합니다. 그래서 장비 ETF는 삽과 곡괭이 역할입니다.', 'Cute animated workers build a glowing chip pipeline with tools, no real people, warm cinematic light.'],
    ['장비 ETF의 위험', '기대가 높으면 변동도 크다', '#ff4f67', true, true, '문제는 기대가 이미 높다는 점입니다. 좋은 기업도 비싸게 사면 흔들립니다.', 'Panda teacher balances a shiny chip against a volatility wave, investor looks cautious.'],
    ['1위', 'TIGER 반도체TOP10', '#ffe200', true, false, '1위는 TIGER 반도체TOP10입니다. 국내 반도체 대표주를 압축합니다.', 'Panda teacher presents ten simplified chip blocks in a premium basket, hero shot, no readable text.'],
    ['왜 대장일까', '삼성전자와 하이닉스 중심', '#31e87a', false, true, '핵심은 대표성입니다. 한국 반도체 흐름을 가장 직관적으로 보여줍니다.', 'Cute animated skyline with two large chip towers and smaller chip companies around them.'],
    ['단점도 분명', '압축은 장점이자 위험', '#ff5a70', true, true, '압축 ETF는 빠르게 움직입니다. 그래서 좋을 때도, 나쁠 때도 크게 반응합니다.', 'Panda teacher holds a compressed spring-shaped ETF basket, animated investor surprised by movement.'],
    ['따라 사기 전', '이 질문부터', '#ffe200', false, true, '따라 사기 전 질문이 필요합니다. 나는 반도체 사이클을 버틸 수 있을까요?', 'Animated beginner stands before two roads: fast glowing chip road and stable slow road.'],
    ['비교 기준 1', '메모리냐 장비냐', '#63e7ff', true, false, '첫 기준은 메모리와 장비입니다. 둘은 같은 반도체라도 움직임이 다릅니다.', 'Panda teacher compares two blank chip baskets, one memory-like, one equipment-like.'],
    ['비교 기준 2', '분산이냐 압축이냐', '#7cffb2', false, true, '둘째는 분산과 압축입니다. 많이 담을수록 완만하고, 좁힐수록 강해집니다.', 'Cute animated scale balancing many tiny chips against a few large glowing chips.'],
    ['비교 기준 3', '가격 부담을 본다', '#ffcf48', true, true, '셋째는 가격 부담입니다. 많이 오른 ETF는 기대가 꺾일 때 더 아플 수 있습니다.', 'Panda teacher checks a glowing price thermometer next to a chip basket, cautious mood.'],
    ['팬더쌤 결론', '대장은 정답이 아니라 후보', '#ffe200', true, false, '결론입니다. 대장 ETF는 정답이 아니라 먼저 볼 후보입니다.', 'Panda teacher closes a clean portfolio notebook with three chip baskets in warm light.'],
    ['마지막 한 문장', '반도체는 구조부터 보자', '#b5ff65', true, true, '초보자라면 이렇게 기억하세요. 이름보다 구조, 수익률보다 변동성입니다.', 'Hopeful cute animation ending with panda teacher and beginner walking along a calm chip-lit path.'],
  ].map(([title, subtitle, accent, pandaVisible, peopleVisible, narration, visualCue], index) => ({
    title,
    subtitle,
    accent,
    panda: pandaVisible,
    people: peopleVisible,
    narration,
    durationSec: index < 4 ? 10 : 11,
    visual: `semiconductor_top3_${String(index + 1).padStart(2, '0')}`,
    imagePrompt: `${baseRules} Scene ${index + 1} of 19: ${visualCue}`,
  }));

  return {
    slug,
    outputBase: slug,
    title: '국내 반도체 대장 ETF TOP 3',
    description: '국내 반도체 ETF를 처음 보는 투자자를 위해 TIGER 반도체TOP10, KODEX AI반도체핵심장비, KODEX 반도체의 구조와 장단점을 쉽게 정리합니다.',
    hookQuestion: '국내 반도체 ETF, 뭐부터 봐야 할까?',
    openingFact: '반도체 ETF는 이름이 비슷해도 메모리, 장비, 압축 비중에 따라 움직임이 달라집니다.',
    tags: ['국내반도체ETF', '반도체ETF', 'TIGER반도체TOP10', 'KODEX반도체', 'KODEXAI반도체핵심장비', 'ETF초보', '국장ETF', '팬더선생'],
    thumbnailText: ['국내 반도체 ETF', '대장 TOP 3', '따라 사기 전'],
    thumbnailEyebrow: '국내 반도체 ETF',
    thumbnailSentence: '이 3개부터 보세요',
    thumbnailSticker: '초보 필수',
    thumbnailSourceScene: 11,
    disclosure: '본 영상은 투자 권유가 아니며 특정 ETF 매수·매도를 추천하지 않습니다. 모든 투자의 최종 판단과 책임은 투자자 본인에게 있습니다.',
    format: 'browser-longform',
    aspect: '16:9',
    assetDir: path.relative(rootDir, assetDir),
    thumbnailFile: `thumbnail-${slug}.jpg`,
    character: {
      name: '팬더 선생',
      consistencyPrompt: character,
    },
    research: {
      selectionCriteria: ['국내 상장 또는 국내 투자자가 접근 가능한 대표 반도체 ETF', '순자산과 대표성', '초보자가 구조 차이를 이해하기 쉬운 상품'],
      top3: [
        { rank: 1, ticker: 'TIGER 반도체TOP10', code: '396500', role: '국내 반도체 대표주 압축형', risk: '대형 반도체주와 사이클 영향이 큼' },
        { rank: 2, ticker: 'KODEX AI반도체핵심장비', code: '471990', role: 'AI 반도체 장비 집중형', risk: '기대가 높아 변동성이 큼' },
        { rank: 3, ticker: 'KODEX 반도체', code: '091160', role: '국내 반도체 밸류체인 분산형', risk: '섹터 ETF라 하락장 방어는 약함' },
      ],
      sources: [
        'K-ETF KODEX 반도체 091160 상품정보',
        'K-ETF KODEX AI반도체핵심장비 471990 상품정보',
        'TIGER 반도체TOP10 396500 상품정보',
      ],
    },
    scenes,
  };
}

async function ensureSceneImages(plan) {
  mkdirSync(assetDir, { recursive: true });
  for (const [index, scene] of plan.scenes.entries()) {
    const file = path.join(assetDir, `scene-${String(index + 1).padStart(2, '0')}.png`);
    const generated = await tryGenerateGeminiScene(scene, index, file);
    if (!generated) {
      await sharp(Buffer.from(sceneImageSvg(scene, index))).png().toFile(file);
    }
  }
}

async function tryGenerateGeminiScene(scene, index, file) {
  if (process.env.GEMINI_SCENE_IMAGES === '0' || !config.geminiApiKey) return false;
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const prompt = [
    scene.imagePrompt,
    'Output one image only, 16:9 widescreen.',
    'No readable text, no letters, no numbers, no logos, no watermark.',
    'Keep the lower 38 percent clean, calm, and darker for one-line Korean captions.',
  ].join('\n');

  try {
    console.log(`Generating Gemini scene image ${index + 1}/${sceneCountLabel()}: ${scene.title}`);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': config.geminiApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
    const parts = json.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
    const b64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
    if (!b64) throw new Error('No image part returned');
    await sharp(Buffer.from(b64, 'base64'))
      .resize(W, H, { fit: 'cover', position: 'center' })
      .png()
      .toFile(file);
    return true;
  } catch (error) {
    console.warn(`Gemini image failed for scene ${index + 1}; using local animation fallback. ${error.message}`);
    return false;
  }
}

function sceneCountLabel() {
  return '19';
}

async function main() {
  const shouldRender = process.argv.includes('render');
  const plan = buildKoreaSemiconductorEtfTop3Plan();
  await ensureSceneImages(plan);

  const payload = `${JSON.stringify({ plan }, null, 2)}\n`;
  writeFileSync(path.join(outDir, 'browser-longform-plan.json'), payload);
  writeFileSync(path.join(outDir, `${slug}-plan.json`), payload);
  await sharp(Buffer.from(thumbnailSvg(plan, path.join(assetDir, 'scene-11.png')))).jpeg({ quality: 95 }).toFile(path.join(outDir, `thumbnail-${slug}.jpg`));
  console.log(`Wrote ${path.join(outDir, `${slug}-plan.json`)}`);
  console.log(`Wrote scene images to ${assetDir}`);
  console.log(`Wrote thumbnail ${path.join(outDir, `thumbnail-${slug}.jpg`)}`);

  if (shouldRender) {
    const result = await renderMatchedLongformVideo(plan);
    console.log(`Rendered video: ${result.videoPath}`);
    console.log(`Rendered thumbnail: ${result.thumbnailPath}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

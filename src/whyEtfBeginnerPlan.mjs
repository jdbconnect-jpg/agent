import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { outDir } from './config.mjs';

const W = 1280;
const H = 720;

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function imageHref(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

function sceneSvg(baseHref, scene, index) {
  const accent = scene.accent || '#ffe200';
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".82"/>
        <stop offset=".55" stop-color="#000" stop-opacity=".34"/>
        <stop offset="1" stop-color="#000" stop-opacity=".04"/>
      </linearGradient>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset=".62" stop-color="#000" stop-opacity=".05"/>
        <stop offset="1" stop-color="#000" stop-opacity=".38"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="6" dy="7" stdDeviation="0" flood-color="#000" flood-opacity=".94"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .label { font-size: 32px; fill: #050505; }
      .title { font-size: 78px; fill: ${accent}; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 6px; }
      .sub { font-size: 42px; fill: #fff; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 4px; }
    </style>
    <image href="${baseHref}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
    <rect width="${W}" height="${H}" fill="url(#bottom)"/>
    <rect x="54" y="52" width="288" height="58" rx="8" fill="${accent}"/>
    <text x="198" y="92" class="label" text-anchor="middle">ETF 팬더쌤</text>
    <text x="68" y="245" class="title">${escapeXml(scene.title)}</text>
    <text x="72" y="318" class="sub">${escapeXml(scene.subtitle)}</text>
    <rect x="70" y="376" width="448" height="76" rx="8" fill="#000" opacity=".54"/>
    <text x="96" y="428" class="sub">${escapeXml(scene.card)}</text>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#050505" stroke-width="22"/>
  </svg>`;
}

function buildPlan() {
  const scenes = [
    {
      title: '주식 처음이면',
      subtitle: '왜 ETF부터 볼까?',
      card: '첫 질문',
      accent: '#ffe200',
      narration: '주식을 처음 시작하면 가장 먼저 막히는 질문이 있습니다. 어떤 종목을 사야 하지? 지금 사도 되나? 뉴스가 나오면 팔아야 하나? 그래서 초보자에게는 개별 종목보다 ETF를 먼저 이해하는 게 훨씬 현실적일 수 있습니다.',
      durationSec: 12,
      visual: 'beginner_crossroads',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Recurring character must stay identical in every scene: small round cute panda teacher, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression, soft 3D animated documentary style. Scene: a confused beginner investor stands at a simple financial crossroads while the panda teacher calmly points to a clear basket-shaped path. No readable text, letters, numbers, logos, watermarks, UI screens. Keep the lower 38% dark, simple, clean, and uncluttered for Korean captions. Stable camera, simple composition.',
    },
    {
      title: '종목 고르기',
      subtitle: '생각보다 어렵다',
      card: '첫 번째 벽',
      accent: '#7cffb2',
      narration: '초보자가 특정 회사를 하나 고르는 건 생각보다 어렵습니다. 실적, 경쟁사, 금리, 환율, 뉴스까지 봐야 하죠. 이름을 안다고 좋은 투자가 되는 건 아닙니다. 익숙한 회사와 좋은 가격은 완전히 다른 문제입니다.',
      durationSec: 12,
      visual: 'stock_picking_maze',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher: small round cute panda, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer. Scene: the panda teacher stands beside a simple maze of blank company blocks and news papers with no readable text, showing that picking one stock is confusing. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% clean and dark for Korean captions. Warm documentary lighting, stable shot.',
    },
    {
      title: '한 종목만 사면',
      subtitle: '내 판단 하나에 흔들린다',
      card: '몰빵 위험',
      accent: '#63e7ff',
      narration: '한 종목만 사면 결과가 내 선택 하나에 크게 달립니다. 좋은 회사라고 믿었는데 실적이 흔들리거나, 갑자기 악재가 나오면 계좌가 크게 흔들릴 수 있습니다. 초보자에게 가장 무서운 건 틀린 선택을 크게 하는 겁니다.',
      durationSec: 13,
      visual: 'single_stock_risk',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher: small round cute panda, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer. Scene: one fragile glass egg with a tiny abstract building inside sits on a desk; the panda teacher points carefully, warning about relying on one stock. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% calm and dark for Korean captions. Minimal, clear, stable camera.',
    },
    {
      title: 'ETF는 바구니',
      subtitle: '여러 종목을 한 번에 담는다',
      card: '핵심 비유',
      accent: '#ffcf48',
      narration: 'ETF는 쉽게 말하면 투자 바구니입니다. 한 회사만 고르는 대신, 여러 회사나 여러 자산이 담긴 바구니 하나를 사는 방식입니다. 그래서 초보자는 처음부터 모든 회사를 분석하지 않아도, 넓게 나눠 담는 구조를 만들 수 있습니다.',
      durationSec: 13,
      visual: 'asset_basket',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher: small round cute panda, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer. Scene: the panda teacher holds a woven basket containing simple abstract buildings, bond papers with no writing, coins, and a globe, representing an ETF basket. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% dark and uncluttered for captions. Clean warm lighting.',
    },
    {
      title: '첫 이유',
      subtitle: '소액으로도 분산된다',
      card: '작게 시작',
      accent: '#ff8a4f',
      narration: '첫 번째 이유는 소액으로도 분산이 된다는 점입니다. 여러 종목을 직접 사려면 돈도 많이 들고 관리도 복잡하지만, ETF는 작은 금액으로도 여러 자산에 나눠 투자하는 효과를 낼 수 있습니다.',
      durationSec: 12,
      visual: 'small_money_spread',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: the panda teacher places a few small coins into several neat transparent jars with abstract asset icons, showing small money spread across many places. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% simple and dark for Korean captions. Stable camera, clean desk.',
    },
    {
      title: '두 번째 이유',
      subtitle: '시장 전체에 참여한다',
      card: '큰 흐름',
      accent: '#b5ff65',
      narration: '두 번째 이유는 시장 전체에 참여하기 쉽다는 점입니다. 초보자가 한 회사를 맞히려 하기보다, 먼저 한국 시장, 미국 시장, 기술주 시장처럼 큰 흐름을 이해하는 편이 더 쉽습니다.',
      durationSec: 12,
      visual: 'whole_market_path',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: the panda teacher looks over a wide glowing market landscape made of simple buildings and smooth paths, symbolizing joining the whole market rather than one company. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% dark clean caption area. Stable wide shot.',
    },
    {
      title: '세 번째 이유',
      subtitle: '관리할 게 줄어든다',
      card: '덜 복잡함',
      accent: '#63e7ff',
      narration: '세 번째 이유는 관리 부담이 줄어든다는 겁니다. 개별 종목을 여러 개 사면 실적 발표, 뉴스, 매수 가격을 계속 봐야 합니다. ETF는 그 부담을 줄여서 초보자가 투자 습관을 만드는 데 도움을 줍니다.',
      durationSec: 13,
      visual: 'simple_routine',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: the panda teacher calmly arranges a tidy desk with one simple basket, one notebook, and a cup of tea, showing reduced investment management stress. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% dark and simple for Korean captions. Soft warm lighting, stable camera.',
    },
    {
      title: '네 번째 이유',
      subtitle: '감정 매매를 줄인다',
      card: '흔들림 관리',
      accent: '#ffcf48',
      narration: '네 번째 이유는 감정 매매를 줄이는 데 도움이 된다는 점입니다. 개별 종목은 뉴스 하나에 마음이 크게 흔들릴 수 있습니다. ETF도 떨어질 수 있지만, 여러 자산이 담긴 구조라 한 종목 뉴스에 모든 판단이 묶이지는 않습니다.',
      durationSec: 13,
      visual: 'emotion_control',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: the panda teacher gently calms a nervous beginner investor while a steady basket sits beside a stormy single stock icon, all abstract with no text. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% clean dark area for Korean captions. Calm warm tone.',
    },
    {
      title: '다섯 번째 이유',
      subtitle: '목적별로 고르기 쉽다',
      card: '역할 나누기',
      accent: '#b5ff65',
      narration: '다섯 번째 이유는 목적별로 고르기 쉽다는 점입니다. 장기 성장, 배당 흐름, 안정적인 채권, 현금 대기처럼 역할을 나눌 수 있습니다. 초보자는 상품 이름보다 내 돈에 어떤 역할을 맡길지 먼저 생각하면 됩니다.',
      durationSec: 13,
      visual: 'purpose_shelves',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: the panda teacher organizes four clean shelves with simple abstract icons for growth, dividend cashflow, bonds, and cash waiting, no readable writing. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% clean dark area for captions. Neat classroom style.',
    },
    {
      title: '하지만 오해 금지',
      subtitle: 'ETF도 손실이 난다',
      card: '원금 보장 아님',
      accent: '#ff4f67',
      narration: '하지만 여기서 오해하면 안 됩니다. ETF는 예금이 아닙니다. 여러 종목이 담겨 있어도 시장이 크게 하락하면 ETF도 같이 떨어질 수 있습니다. 쉬운 도구라는 말이 안전하다는 뜻은 아닙니다.',
      durationSec: 12,
      visual: 'risk_warning',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: the panda teacher points to a simple warning sign beside an ETF basket near a small floor crack, symbolizing loss risk. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% dark and uncluttered for captions. Slightly tense but clean.',
    },
    {
      title: '테마형은 조심',
      subtitle: '집중될수록 크게 흔들린다',
      card: '쏠림 위험',
      accent: '#ff8a4f',
      narration: '특히 테마형 ETF는 조심해야 합니다. AI, 반도체, 배터리처럼 특정 산업에 집중된 ETF는 잘 오를 때는 강해 보이지만, 반대로 흔들릴 때도 크게 흔들릴 수 있습니다.',
      durationSec: 12,
      visual: 'theme_concentration',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: several colorful spotlight beams all focus on one narrow industry tower while the panda teacher raises a gentle caution gesture, showing theme concentration risk. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% clean dark caption area. Stable camera.',
    },
    {
      title: '수수료도 본다',
      subtitle: '작아 보여도 누적된다',
      card: '비용 확인',
      accent: '#63e7ff',
      narration: 'ETF를 볼 때는 수수료도 확인해야 합니다. 당장은 작아 보여도 오래 투자하면 차이가 쌓일 수 있습니다. 초보자는 무엇을 담았는지, 얼마나 흔들리는지, 비용은 어떤지 세 가지를 같이 봐야 합니다.',
      durationSec: 12,
      visual: 'fee_magnifier',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: the panda teacher uses a magnifying glass over a simple basket and tiny coin trail, symbolizing checking fees and hidden costs, no text. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% dark uncluttered caption space. Clean desk, stable camera.',
    },
    {
      title: '초보자 체크',
      subtitle: '세 질문만 기억하자',
      card: '담은 것·목적·기간',
      accent: '#ffe200',
      narration: 'ETF를 사기 전에는 세 질문만 기억해도 됩니다. 무엇을 담고 있나. 왜 내 계좌에 필요한가. 떨어져도 얼마나 오래 들고 갈 수 있나. 이 질문에 답하지 못하면 인기 상품도 불안해집니다.',
      durationSec: 13,
      visual: 'three_questions',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: the panda teacher holds three blank question cards next to a calm ETF basket and a simple investor notebook, no writing on cards. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% clean dark caption area. Stable centered shot.',
    },
    {
      title: '처음 시작법',
      subtitle: '큰 시장부터 천천히',
      card: '작게 연습',
      accent: '#7cffb2',
      narration: '처음 시작한다면 복잡한 상품보다 큰 시장을 담은 ETF부터 공부하는 게 좋습니다. 그리고 한 번에 크게 사기보다, 작게 시작해서 내가 하락을 어떻게 견디는지 확인하는 과정이 필요합니다.',
      durationSec: 13,
      visual: 'small_first_step',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: the panda teacher guides a beginner investor taking a small first step onto a wide calm market bridge made of abstract tiles, symbolizing starting small with broad markets. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% dark simple caption area.',
    },
    {
      title: '짧은 결론',
      subtitle: '초보자는 구조부터 배운다',
      card: '천천히 오래',
      accent: '#7cffb2',
      narration: '정리하면 초보자가 ETF를 봐야 하는 이유는 간단합니다. 한 종목에 기대는 부담을 줄이고, 작은 돈으로 분산을 배우고, 시장 전체를 이해하기 위해서입니다. ETF는 돈을 바로 벌게 해주는 정답이 아니라, 투자 구조와 습관을 배우는 출발점입니다.',
      durationSec: 15,
      visual: 'map_not_answer',
      imagePrompt: 'Create one polished 16:9 Korean finance documentary illustration. Same recurring panda teacher. Scene: the panda teacher opens a glowing blank map on a table with gentle paths to broad financial goals, showing ETF as a starting point and guide. No readable text, letters, numbers, logos, watermarks, UI screens. Lower 38% dark and uncluttered for Korean captions. Warm hopeful ending, stable camera.',
    },
  ];

  return {
    ticker: 'ETF-WHY-BEGINNER',
    slug: 'why-buy-etf-beginner-panda',
    outputBase: 'why-buy-etf-beginner-panda',
    title: '주식 초보자가 ETF부터 봐야 하는 이유',
    description: '주식 초보자가 왜 개별 종목보다 ETF의 구조를 먼저 이해하면 좋은지, 분산·비용·감정관리·리스크까지 쉽게 정리합니다.',
    hookQuestion: '주식 초보자는 왜 ETF부터 봐야 할까?',
    openingFact: 'ETF는 초보자가 한 종목에 모든 판단을 걸지 않고 분산과 시장 흐름을 배울 수 있는 도구입니다.',
    tags: ['ETF', 'ETF초보', '주식초보', '초보투자', '재테크', '분산투자', '투자공부', 'ETF사는이유'],
    thumbnailText: ['주식 초보라면', 'ETF부터 보세요', '이유 5가지'],
    thumbnailEyebrow: '주식 초보 필수',
    thumbnailSentence: 'ETF부터 봐야 하는 이유',
    thumbnailSticker: '모르면 손해',
    thumbnailSourceScene: 4,
    disclosure: '본 영상은 투자 권유가 아니며, 특정 ETF의 매수·매도를 추천하지 않습니다. 초보자가 ETF의 구조와 위험을 이해하기 위한 정보 제공용 콘텐츠입니다.',
    format: 'browser-longform',
    aspect: '16:9',
    assetDir: 'out/ai-scenes-why-buy-etf-beginner-panda',
    thumbnailFile: 'thumbnail-why-buy-etf-beginner-panda.jpg',
    character: {
      name: '팬더 선생',
      consistencyPrompt: 'same cute panda teacher character in every scene, small round panda, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression, soft 3D animated documentary style',
    },
    scenes,
  };
}

async function main() {
  const plan = buildPlan();
  const assetDir = path.join(outDir, 'ai-scenes-why-buy-etf-beginner-panda');
  mkdirSync(assetDir, { recursive: true });

  const baseImage = existsSync(path.join(outDir, 'gemini-thumbnail-base.png'))
    ? path.join(outDir, 'gemini-thumbnail-base.png')
    : path.join(outDir, 'thumbnail-korea-etf-beginner-top5-retention.jpg');
  const baseHref = imageHref(baseImage);

  for (const [index, scene] of plan.scenes.entries()) {
    const target = path.join(assetDir, `scene-${String(index + 1).padStart(2, '0')}.png`);
    await sharp(Buffer.from(sceneSvg(baseHref, scene, index))).png().toFile(target);
  }

  const payload = `${JSON.stringify({ plan }, null, 2)}\n`;
  writeFileSync(path.join(outDir, 'browser-longform-plan.json'), payload);
  writeFileSync(path.join(outDir, 'why-buy-etf-beginner-panda-plan.json'), payload);
  console.log(`Wrote ${path.join(outDir, 'why-buy-etf-beginner-panda-plan.json')}`);
  console.log(`Wrote scenes to ${assetDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

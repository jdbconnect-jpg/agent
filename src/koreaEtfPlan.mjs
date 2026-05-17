import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { outDir, rootDir } from './config.mjs';
import { renderMatchedLongformVideo } from './alignedLongformMedia.mjs';

const slug = 'korea-etf-top5-beginner-2026-05';
const assetDir = path.join(outDir, `ai-scenes-${slug}`);

function sceneImageSvg(scene, index) {
  const accents = ['#ffe200', '#31e87a', '#63e7ff', '#7cffb2', '#ffcf48', '#ff7aa2'];
  const accent = accents[index % accents.length];
  const lineY = 190 + (index % 4) * 48;
  return `
  <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#07100f"/>
        <stop offset=".48" stop-color="#11110b"/>
        <stop offset="1" stop-color="#030303"/>
      </linearGradient>
      <radialGradient id="glow" cx="${index % 2 ? '72%' : '28%'}" cy="22%" r="60%">
        <stop offset="0" stop-color="${accent}" stop-opacity=".32"/>
        <stop offset=".5" stop-color="${accent}" stop-opacity=".08"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)"/>
    <rect width="1280" height="720" fill="url(#glow)"/>
    <g opacity=".22" stroke="#fff" stroke-width="2">
      ${Array.from({ length: 9 }, (_, i) => `<line x1="${110 + i * 126}" y1="110" x2="${110 + i * 126}" y2="420"/>`).join('')}
      ${Array.from({ length: 5 }, (_, i) => `<line x1="88" y1="${120 + i * 70}" x2="1170" y2="${120 + i * 70}"/>`).join('')}
    </g>
    <path d="M90 ${lineY + 90} C230 ${lineY + 10}, 345 ${lineY + 120}, 495 ${lineY + 50} S760 ${lineY - 20}, 920 ${lineY + 42} S1090 ${lineY + 106}, 1190 ${lineY + 8}" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" opacity=".82"/>
    <g opacity=".34" filter="url(#soft)">
      <circle cx="${index % 2 ? 970 : 330}" cy="210" r="96" fill="${accent}"/>
      <circle cx="${index % 2 ? 1060 : 230}" cy="310" r="42" fill="#ffffff"/>
    </g>
    <rect x="0" y="462" width="1280" height="258" fill="#000" opacity=".56"/>
  </svg>`;
}

async function ensureSceneImages(plan) {
  mkdirSync(assetDir, { recursive: true });
  for (const [index, scene] of plan.scenes.entries()) {
    const file = path.join(assetDir, `scene-${String(index + 1).padStart(2, '0')}.png`);
    await sharp(Buffer.from(sceneImageSvg(scene, index))).png().toFile(file);
  }
}

export function buildKoreaEtfPlan() {
  return {
    slug,
    title: '국장에서 처음 보면 좋은 ETF TOP 5, 초보자용으로 쉽게 정리',
    hookQuestion: '국장 ETF, 뭐부터 보면 덜 헤맬까?',
    openingFact: '국내 상장 ETF 상위권은 시장대표와 미국지수, 반도체 테마가 함께 움직입니다.',
    format: 'longform',
    language: 'ko-KR',
    targetDurationSec: 270,
    assetDir: path.relative(rootDir, assetDir),
    thumbnailText: ['국장 ETF TOP 5', '초보자도 이해되는', '따라 사기 전 체크'],
    description: '국내 상장 ETF를 처음 보는 사람을 위해 KODEX 200, TIGER 미국S&P500, TIGER 미국나스닥100, TIGER 반도체TOP10, KODEX CD금리액티브의 역할과 주의점을 쉽게 정리합니다. 투자 권유가 아닌 정보 제공용 콘텐츠입니다.',
    sources: [
      '메리츠증권 리서치센터 2026-05-11 국내 상장 ETF 시총 Top 40',
      'K-ETF KODEX 200 상품정보',
      'K-ETF KODEX CD금리액티브(합성) 상품정보',
      '미래에셋 TIGER 미국S&P500 운용보고서',
    ],
    research: {
      selectionCriteria: [
        '국내 증권계좌에서 살 수 있는 국내 상장 ETF',
        '순자산과 관심도가 큰 대표 상품 우선',
        '초보자가 역할을 이해하기 쉬운 상품 우선',
        '같은 역할이 겹치면 하나만 선택',
      ],
      top5: [
        {
          rank: 1,
          ticker: 'KODEX 200',
          code: '069500',
          shortName: 'KODEX 200',
          name: 'KODEX 200',
          role: '한국 주식시장 대표 바구니',
          reason: '코스피200을 따라가서 한국 대형주 흐름을 한 번에 볼 수 있습니다.',
          risk: '한국 시장이 흔들리면 같이 흔들리고, 삼성전자 같은 대형주 비중 영향이 큽니다.',
        },
        {
          rank: 2,
          ticker: 'TIGER 미국S&P500',
          code: '360750',
          shortName: '미국S&P500',
          name: 'TIGER 미국S&P500',
          role: '미국 대표 500개 기업 바구니',
          reason: '국장 계좌로 미국 대표 기업에 분산 투자하는 가장 직관적인 선택지입니다.',
          risk: '미국 주식뿐 아니라 원달러 환율 영향도 함께 받습니다.',
        },
        {
          rank: 3,
          ticker: 'TIGER 미국나스닥100',
          code: '133690',
          shortName: '미국나스닥100',
          name: 'TIGER 미국나스닥100',
          role: '미국 성장주와 기술주 바구니',
          reason: 'AI와 빅테크 성장에 투자하고 싶을 때 이해하기 쉬운 대표 ETF입니다.',
          risk: '기술주 쏠림이 커서 좋을 때 크게 오르지만 조정도 깊을 수 있습니다.',
        },
        {
          rank: 4,
          ticker: 'TIGER 반도체TOP10',
          code: '396500',
          shortName: '반도체TOP10',
          name: 'TIGER 반도체TOP10',
          role: '국내 반도체 핵심 기업 바구니',
          reason: '한국 시장에서 가장 관심이 큰 반도체 대형주를 압축해서 볼 수 있습니다.',
          risk: '섹터 ETF라 분산이 약하고 반도체 사이클에 따라 변동성이 커질 수 있습니다.',
        },
        {
          rank: 5,
          ticker: 'KODEX CD금리액티브',
          code: '459580',
          shortName: 'CD금리액티브',
          name: 'KODEX CD금리액티브(합성)',
          role: '현금 대기처에 가까운 금리형 ETF',
          reason: '바로 투자하기 애매한 돈을 잠시 세워두는 용도로 많이 비교됩니다.',
          risk: '예금이 아니며 금리 변화, 합성 구조, 보수와 괴리율을 확인해야 합니다.',
        },
      ],
    },
    scenes: [
      {
        title: 'ETF가 처음이면',
        subtitle: '주식 바구니부터 이해',
        visual: 'simple_market_basket',
        narration: 'ETF를 처음 보면 이름부터 어렵습니다. 그런데 아주 쉽게 말하면 ETF는 여러 주식이나 자산을 한 바구니에 담아 놓은 상품입니다. 사과 하나를 고르는 게 아니라 과일 바구니를 사는 것처럼, 종목 하나를 맞히기보다 시장이나 테마 전체에 나눠 투자하는 방식입니다.',
      },
      {
        title: '오늘의 기준',
        subtitle: '많이 사는 것보다 역할',
        visual: 'selection_criteria',
        narration: '오늘은 국장, 그러니까 국내 증권계좌에서 살 수 있는 ETF 중에서 초보자가 먼저 이해하기 좋은 다섯 개를 뽑았습니다. 기준은 단순합니다. 순자산과 관심도가 크고, 역할이 분명하고, 이름만 보고도 왜 사는지 설명할 수 있는 ETF입니다. 이 순위는 투자 추천이 아니라 공부 순서에 가깝습니다.',
      },
      {
        title: '5위 CD금리액티브',
        subtitle: '현금 대기처 느낌',
        visual: 'cash_parking_etf',
        narration: '5위는 KODEX CD금리액티브입니다. 이건 주가가 크게 오르는 걸 노리는 상품이라기보다, 투자할 돈을 잠깐 세워두는 현금 대기처에 가까운 ETF입니다. 다만 은행 예금은 아닙니다. 금리형 ETF도 가격이 움직일 수 있고, 합성이라는 구조가 붙어 있으니 이름만 보고 안전하다고 단정하면 안 됩니다.',
      },
      {
        title: '4위 반도체TOP10',
        subtitle: '한국 대표 테마',
        visual: 'semiconductor_sector',
        narration: '4위는 TIGER 반도체TOP10입니다. 한국 주식시장에서 반도체를 빼고 이야기하기 어렵죠. 이 ETF는 반도체 관련 핵심 기업을 압축해서 담는 방식이라, 시장이 반도체에 집중할 때 관심이 몰립니다. 대신 테마 ETF는 넓게 분산된 상품이 아닙니다. 반도체 사이클이 꺾이면 흔들림도 커질 수 있습니다.',
      },
      {
        title: '3위 미국나스닥100',
        subtitle: '성장주는 강하지만 거칠다',
        visual: 'nasdaq_growth',
        narration: '3위는 TIGER 미국나스닥100입니다. 애플, 엔비디아, 마이크로소프트 같은 미국 기술주 흐름을 보고 싶다면 초보자도 이해하기 쉬운 ETF입니다. 장점은 성장성입니다. 단점도 같은 곳에 있습니다. 기술주 비중이 높기 때문에 오를 때는 빠르지만, 금리나 실적 우려가 생기면 하락도 빠를 수 있습니다.',
      },
      {
        title: '2위 미국S&P500',
        subtitle: '미국 대표 500개',
        visual: 'sp500_core',
        narration: '2위는 TIGER 미국S&P500입니다. 국내 계좌에서 미국 대표 500개 기업에 투자하는 가장 익숙한 방법 중 하나입니다. 초보자에게 좋은 이유는 설명이 쉽다는 점입니다. 미국 경제 전체에 가까운 넓은 바구니를 사는 겁니다. 다만 원화로 사더라도 실제로는 미국 자산이라 환율 영향이 따라옵니다.',
      },
      {
        title: '1위 KODEX 200',
        subtitle: '한국 시장 대표 바구니',
        visual: 'kospi200_core',
        narration: '1위는 KODEX 200입니다. 코스피200을 따라가는 국내 대표 ETF입니다. 한국 주식시장에 처음 접근한다면 가장 기본 교과서 같은 상품이라고 볼 수 있습니다. 한국 대형주 흐름을 한 번에 볼 수 있지만, 한국 시장 자체가 부진하면 ETF도 같이 부진합니다. 대표 상품이라는 말이 원금 보장을 뜻하지는 않습니다.',
      },
      {
        title: '초보자 조합법',
        subtitle: '코어와 테마를 나누기',
        visual: 'portfolio_map',
        narration: '초보자는 ETF를 고를 때 이름보다 역할을 먼저 보면 좋습니다. KODEX 200이나 미국S&P500처럼 넓은 시장을 담는 ETF는 중심축, 나스닥100이나 반도체TOP10은 성장과 테마, CD금리형은 잠시 쉬어가는 돈의 자리로 나눠 보는 겁니다. 이렇게 나누면 남들이 산다는 이유만으로 따라 사는 실수를 줄일 수 있습니다.',
      },
      {
        title: '진짜 함정',
        subtitle: '비슷한 이름이 너무 많다',
        visual: 'risk_checklist',
        narration: 'ETF에서 진짜 헷갈리는 부분은 이름이 비슷하다는 겁니다. S&P500도 TIGER, KODEX, ACE가 있고 환헤지형, TR형, 커버드콜형처럼 구조가 다를 수 있습니다. 그래서 사기 전에 세 가지만 확인하세요. 무엇을 따라가는지, 총보수와 실제 비용은 어떤지, 그리고 분배금과 세금 구조가 내 계좌에 맞는지입니다.',
      },
      {
        title: '짧은 결론',
        subtitle: '좋은 ETF보다 맞는 ETF',
        visual: 'closing_decision',
        narration: '정리하면 국장 ETF TOP 5를 외우는 것보다 중요한 건 역할을 구분하는 겁니다. 한국 시장은 KODEX 200, 미국 넓은 시장은 TIGER 미국S&P500, 성장주는 미국나스닥100, 테마는 반도체TOP10, 대기 자금은 CD금리형처럼 생각해보면 훨씬 쉽습니다. 좋은 ETF를 찾기 전에, 내 돈이 왜 그 ETF에 들어가야 하는지 먼저 말할 수 있어야 합니다.',
      },
    ],
  };
}

async function main() {
  const mode = process.argv[2] || 'plan';
  const plan = buildKoreaEtfPlan();
  await ensureSceneImages(plan);
  const planPath = path.join(outDir, `${slug}-plan.json`);
  writeFileSync(planPath, JSON.stringify(plan, null, 2));
  writeFileSync(path.join(outDir, 'browser-longform-plan.json'), JSON.stringify(plan, null, 2));
  writeFileSync(path.join(outDir, 'video-plan.json'), JSON.stringify(plan, null, 2));
  console.log(`Saved ${planPath}`);

  if (mode === 'render') {
    const result = await renderMatchedLongformVideo(plan);
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

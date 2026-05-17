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

function sceneSvg(baseHref, scene) {
  const accent = scene.accent || '#ffe200';
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".76"/>
        <stop offset=".56" stop-color="#000" stop-opacity=".28"/>
        <stop offset="1" stop-color="#000" stop-opacity=".04"/>
      </linearGradient>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset=".60" stop-color="#000" stop-opacity=".06"/>
        <stop offset="1" stop-color="#000" stop-opacity=".42"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="6" dy="7" stdDeviation="0" flood-color="#000" flood-opacity=".94"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .label { font-size: 32px; fill: #050505; }
      .title { font-size: 76px; fill: ${accent}; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 6px; }
      .sub { font-size: 42px; fill: #fff; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 4px; }
    </style>
    <image href="${baseHref}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
    <rect width="${W}" height="${H}" fill="url(#bottom)"/>
    <rect x="54" y="52" width="286" height="58" rx="8" fill="${accent}"/>
    <text x="197" y="92" class="label" text-anchor="middle">ETF 팬더쌤</text>
    <text x="68" y="248" class="title">${escapeXml(scene.title)}</text>
    <text x="72" y="320" class="sub">${escapeXml(scene.subtitle)}</text>
    <rect x="70" y="378" width="500" height="76" rx="8" fill="#000" opacity=".55"/>
    <text x="96" y="430" class="sub">${escapeXml(scene.card)}</text>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#050505" stroke-width="22"/>
  </svg>`;
}

export function buildMonthlyDividendEtfPlan() {
  const character = 'same recurring cute panda teacher, small round panda, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression, soft 3D animated documentary style';
  const baseRules = 'Create one polished 16:9 Korean finance documentary illustration. Character consistency is critical: same recurring cute panda teacher in every scene, small round panda, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression, soft 3D animated documentary style. No readable text, letters, numbers, logos, ETF tickers, watermarks, UI screenshots, or charts with readable labels. Keep the lower 38 percent dark, calm, simple, and uncluttered for Korean captions. Stable camera, no motion blur, clean composition.';
  const scenes = [
    ['월배당의 유혹', '매달 돈이 들어온다?', '혹하는 질문', '#ffe200', '월배당 ETF를 처음 보면 가장 먼저 이런 생각이 듭니다. 매달 돈이 들어오면 월급 하나 더 생기는 거 아닐까? 이름만 보면 정말 안정적인 현금흐름처럼 느껴집니다.', 'A Korean beginner investor looks at a phone with soft monthly cashflow symbols while the panda teacher watches cautiously beside a calendar-shaped desk prop.'],
    ['월급처럼 보이지만', '정말 같은 돈일까?', '첫 반전', '#ffcf48', '그런데 여기서 첫 번째 반전이 있습니다. 월배당 ETF의 분배금은 회사 월급처럼 고정된 약속이 아닙니다. 시장 상황과 운용 방식에 따라 금액이 달라질 수 있습니다.', 'The panda teacher gently holds up two objects: a steady salary envelope and a fluctuating investment basket, showing they are not the same.'],
    ['ETF는 예금 아님', '원금도 움직인다', '가장 중요한 전제', '#ff4f67', '월배당이라는 단어 때문에 안전해 보일 수 있지만 ETF는 예금이 아닙니다. 주식이나 채권, 옵션 전략이 들어가면 가격은 매일 흔들립니다. 배당을 받아도 원금이 줄면 전체 수익은 달라집니다.', 'A calm ETF basket on a desk sits beside a small wave-shaped price path while the panda teacher points at the moving basket carefully.'],
    ['왜 매달 줄까', '구조가 다르다', '배당의 출처', '#7cffb2', '월배당 ETF는 보유 자산에서 나온 배당이나 이자, 옵션 프리미엄 등을 모아 매달 나눠주는 구조가 많습니다. 중요한 건 돈이 어디서 나오는지입니다. 같은 월배당이어도 속은 완전히 다를 수 있습니다.', 'The panda teacher opens a transparent basket showing simple abstract pieces: dividends, interest coins, and option premium ribbons, with no text.'],
    ['커버드콜 ETF', '높은 분배율의 이유', '인기 구조', '#63e7ff', '요즘 많이 언급되는 월배당 ETF 중에는 커버드콜 전략을 쓰는 상품이 많습니다. 쉽게 말해 주식을 들고 있으면서 옵션 프리미엄을 받는 방식입니다. 그래서 분배금이 커 보일 수 있습니다.', 'The panda teacher explains a simple covered-call metaphor using a covered basket and a small premium coin stream, no readable labels.'],
    ['대신 포기하는 것', '상승 여력 제한', '숨은 비용', '#ff8a4f', '하지만 공짜는 아닙니다. 커버드콜은 시장이 크게 오를 때 상승분 일부를 놓칠 수 있습니다. 매달 받는 현금흐름과 장기 성장 사이에서 교환이 생기는 겁니다.', 'A split path: one path gives monthly coins, another path climbs higher with a tree; the panda teacher stands between them with a balanced expression.'],
    ['분배율 착시', '수익률과 다르다', '숫자 함정', '#ffe200', '초보자가 가장 많이 헷갈리는 숫자가 분배율입니다. 분배율이 높다고 실제 투자 수익률이 높다는 뜻은 아닙니다. 가격 하락까지 함께 봐야 진짜 결과가 보입니다.', 'The panda teacher points to a large shiny coin stack and a shadowed shrinking basket behind it, showing attractive payout versus total return risk.'],
    ['원금 환급 가능성', '내 돈이 돌아올 수도', '꼭 확인', '#ff4f67', '일부 상품은 분배금 안에 투자 원금이 일부 돌아오는 성격이 섞일 수 있습니다. 겉으로는 배당처럼 보이지만 실제로는 내 돈 일부를 나눠 받는 느낌일 수 있습니다. 그래서 공시와 자료를 봐야 합니다.', 'A panda teacher gently separates incoming coins into two bowls: investment income and returned capital, using blank bowls with no writing.'],
    ['월 100만 원?', '필요 원금은 크다', '현실 계산', '#ffcf48', '예를 들어 세후로 매달 백만 원을 기대한다면 생각보다 큰 원금이 필요합니다. 분배율이 높아 보여도 세금과 환율, 가격 변동을 빼고 보면 체감은 달라집니다. 월배당은 마법이 아니라 계산입니다.', 'A realistic desk with a calculator, many coin stacks, and the panda teacher looking serious; no readable numbers on the calculator.'],
    ['세금도 빠진다', '받는 돈은 줄어든다', '체감 금액', '#63e7ff', '해외 ETF 분배금은 세금도 고려해야 합니다. 국내 계좌, 해외 계좌, ISA 여부에 따라 체감 수익이 달라질 수 있습니다. 영상에서는 단순히 많이 준다는 말보다 실제 남는 돈을 봐야 합니다.', 'The panda teacher places coins through a small filter funnel into a wallet, showing taxes reduce received cash without any text.'],
    ['환율도 변수', '달러 월배당의 함정', '원화 체감', '#7cffb2', '미국 ETF로 월배당을 받으면 환율도 변수입니다. 달러로 받은 금액은 같아도 원화로 바꾸면 체감이 달라질 수 있습니다. 월 현금흐름을 생활비처럼 쓰려면 이 부분도 봐야 합니다.', 'A globe, dollar-colored coins, and Korean won-colored coins as abstract currency shapes, with the panda teacher comparing two scales, no symbols or letters.'],
    ['가격 하락 구간', '배당이 방어막은 아님', '리스크 장면', '#ff4f67', '시장이 하락할 때 월배당은 심리적으로 위로가 됩니다. 하지만 분배금이 가격 하락을 항상 막아주지는 못합니다. 계좌 전체는 배당과 가격을 합쳐서 봐야 합니다.', 'A rainy market window behind a calm panda teacher holding an umbrella over an ETF basket; some coins fall into the basket but the ground slopes down.'],
    ['어울리는 사람', '현금흐름이 필요한 경우', '사용법', '#b5ff65', '그렇다고 월배당 ETF가 나쁘다는 뜻은 아닙니다. 은퇴 후 현금흐름이 필요하거나, 포트폴리오 일부에서 정기적인 분배를 원하는 사람에게는 도구가 될 수 있습니다. 다만 목적이 분명해야 합니다.', 'The panda teacher helps an older investor organize a calm monthly cashflow desk with simple envelopes and a basket, no text.'],
    ['안 맞는 사람', '장기 성장만 원한다면', '주의 대상', '#ff8a4f', '반대로 장기 성장을 가장 크게 원한다면 월배당이 항상 최선은 아닐 수 있습니다. 매달 받는 돈이 좋아 보여도, 재투자와 가격 성장의 기회비용을 생각해야 합니다.', 'A young investor looks at two paths: monthly coins path and compounding tree path, while the panda teacher points to the decision calmly.'],
    ['비교해야 할 것', '분배율 말고 세 가지', '체크리스트', '#63e7ff', '월배당 ETF를 볼 때는 세 가지만 먼저 확인하면 됩니다. 무엇을 담고 있는지, 분배금이 어디서 나오는지, 가격 변동을 내가 버틸 수 있는지입니다. 이 세 가지가 더 중요합니다.', 'The panda teacher holds three blank cards near a simple ETF basket, with icons only and no readable text.'],
    ['커버드콜 vs 배당성장', '목적이 다르다', '비교 관점', '#ffe200', '커버드콜 ETF는 현금흐름에 강점이 있고, 배당성장 ETF는 시간이 지나며 기업 체력을 보는 경우가 많습니다. 둘 중 하나가 무조건 정답은 아닙니다. 내 목적에 따라 선택 기준이 달라집니다.', 'Two neatly separated shelves: one with monthly coins, one with a growing dividend tree, panda teacher between them.'],
    ['전부 넣지 말자', '포트폴리오 일부로', '비중 관리', '#ffcf48', '초보자라면 월배당 ETF에 전부 넣기보다 포트폴리오 일부로 보는 편이 더 현실적입니다. 현금흐름, 성장, 안정 자산을 나눠야 흔들릴 때 버티기 쉽습니다.', 'A balanced portfolio tray divided into calm sections: cashflow coins, growth tree, bond stones, with panda teacher arranging pieces.'],
    ['월급처럼 쓰려면', '분배금 변동을 감안', '생활비 계획', '#7cffb2', '월급처럼 쓰고 싶다면 더 보수적으로 계산해야 합니다. 분배금이 줄어드는 달, 가격이 흔들리는 달, 세금이 빠지는 상황을 미리 넣어야 합니다. 그래야 실망이 줄어듭니다.', 'A household budgeting table with blank calendar pages, a panda teacher helping arrange variable envelopes and coins, no text.'],
    ['팬더쌤 결론', '월급은 아니고 도구다', '짧은 결론', '#ffe200', '결론입니다. 월배당 ETF는 월급이 아니라 투자 도구입니다. 매달 돈이 들어온다는 장점은 있지만, 원금 변동과 분배금 변동, 세금과 환율까지 같이 봐야 합니다.', 'The panda teacher stands confidently beside a calm ETF toolbox and a basket, with a warm but cautious classroom mood.'],
    ['마지막 한 문장', '높은 분배율보다 구조', '기억할 말', '#b5ff65', '초보자라면 이렇게 기억하면 됩니다. 월배당 ETF를 고를 때는 얼마나 자주 주는지보다, 무엇으로 주는지부터 보세요. 구조를 이해하면 혹하는 숫자에 덜 흔들립니다.', 'A hopeful closing scene: the panda teacher opens a blank map with a clear path from cashflow to risk understanding, warm sunrise lighting.'],
  ].map(([title, subtitle, card, accent, narration, visualCue], index) => ({
    title,
    subtitle,
    card,
    accent,
    narration,
    durationSec: index === 19 ? 10 : 9,
    visual: `monthly_dividend_${String(index + 1).padStart(2, '0')}`,
    imagePrompt: `${baseRules} Scene ${index + 1} of 20: ${visualCue}`,
  }));

  return {
    ticker: 'MONTHLY-DIVIDEND-ETF',
    slug: 'monthly-dividend-etf-paycheck-panda',
    outputBase: 'monthly-dividend-etf-paycheck-panda',
    title: '월배당 ETF, 진짜 월급처럼 받아도 될까?',
    description: '월배당 ETF가 매달 현금흐름을 주는 구조와 커버드콜, 분배율 착시, 원금 변동, 세금과 환율 리스크를 초보자도 이해하기 쉽게 정리합니다.',
    hookQuestion: '월배당 ETF는 정말 월급처럼 받아도 될까?',
    openingFact: '월배당 ETF의 매력은 현금흐름이지만, 분배금은 고정 월급이 아니고 원금도 변동될 수 있습니다.',
    tags: ['월배당ETF', 'ETF초보', '배당ETF', '커버드콜ETF', 'JEPI', 'JEPQ', 'QYLD', '분배금', '투자초보', '팬더선생'],
    thumbnailText: ['월배당 ETF', '월급처럼?', '진짜 함정'],
    thumbnailEyebrow: '월배당 ETF',
    thumbnailSentence: '월급처럼 믿으면 위험',
    thumbnailSticker: '초보 필수',
    thumbnailSourceScene: 1,
    disclosure: '본 영상은 투자 권유가 아니며 특정 ETF 매수·매도를 추천하지 않습니다. 월배당 ETF의 구조와 위험을 이해하기 위한 정보 제공용 콘텐츠입니다.',
    format: 'browser-longform',
    aspect: '16:9',
    assetDir: 'out/ai-scenes-monthly-dividend-etf-paycheck-panda',
    thumbnailFile: 'thumbnail-monthly-dividend-etf-paycheck-panda.jpg',
    character: {
      name: '팬더 선생',
      consistencyPrompt: character,
    },
    scenes,
  };
}

async function main() {
  const plan = buildMonthlyDividendEtfPlan();
  const assetDir = path.join(outDir, 'ai-scenes-monthly-dividend-etf-paycheck-panda');
  mkdirSync(assetDir, { recursive: true });

  const baseImage = existsSync(path.join(outDir, 'gemini-thumbnail-base.png'))
    ? path.join(outDir, 'gemini-thumbnail-base.png')
    : path.join(outDir, 'thumbnail-why-buy-etf-beginner-panda.jpg');
  const baseHref = imageHref(baseImage);

  for (const [index, scene] of plan.scenes.entries()) {
    const target = path.join(assetDir, `scene-${String(index + 1).padStart(2, '0')}.png`);
    if (!existsSync(target)) {
      await sharp(Buffer.from(sceneSvg(baseHref, scene, index))).png().toFile(target);
    }
  }

  const payload = `${JSON.stringify({ plan }, null, 2)}\n`;
  writeFileSync(path.join(outDir, 'browser-longform-plan.json'), payload);
  writeFileSync(path.join(outDir, 'monthly-dividend-etf-paycheck-panda-plan.json'), payload);
  console.log(`Wrote ${path.join(outDir, 'monthly-dividend-etf-paycheck-panda-plan.json')}`);
  console.log(`Wrote placeholder scenes to ${assetDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

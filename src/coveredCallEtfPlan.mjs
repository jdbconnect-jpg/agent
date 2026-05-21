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
        <stop offset="0" stop-color="#000" stop-opacity=".82"/>
        <stop offset=".58" stop-color="#000" stop-opacity=".30"/>
        <stop offset="1" stop-color="#000" stop-opacity=".05"/>
      </linearGradient>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset=".58" stop-color="#000" stop-opacity=".08"/>
        <stop offset="1" stop-color="#000" stop-opacity=".50"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="6" dy="7" stdDeviation="0" flood-color="#000" flood-opacity=".94"/>
      </filter>
    </defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .label { font-size: 31px; fill: #050505; }
      .title { font-size: 72px; fill: ${accent}; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 6px; }
      .sub { font-size: 41px; fill: #fff; filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 4px; }
    </style>
    <image href="${baseHref}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
    <rect width="${W}" height="${H}" fill="url(#bottom)"/>
    <rect x="54" y="52" width="286" height="58" rx="8" fill="${accent}"/>
    <text x="197" y="92" class="label" text-anchor="middle">커버드콜 ETF</text>
    <text x="68" y="248" class="title">${escapeXml(scene.title)}</text>
    <text x="72" y="320" class="sub">${escapeXml(scene.subtitle)}</text>
    <rect x="70" y="378" width="500" height="76" rx="8" fill="#000" opacity=".55"/>
    <text x="96" y="430" class="sub">${escapeXml(scene.card)}</text>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#050505" stroke-width="22"/>
  </svg>`;
}

export function buildCoveredCallEtfPlan() {
  const character = 'same recurring cute panda teacher, small round panda, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression, soft 3D animated documentary style';
  const baseRules = [
    'Create one polished 16:9 Korean finance documentary illustration.',
    'Use a varied scene, not only the panda: mix friendly illustrated Korean beginner investor characters, office worker characters, couple characters, symbolic market objects, and occasionally the recurring panda teacher as a small guide.',
    'All non-panda people must look like warm, familiar animated illustration characters, not real humans and not photorealistic: rounded faces, soft 3D storybook style, gentle expressions, approachable YouTube educational art.',
    `When the panda appears, keep this exact character: ${character}.`,
    'No readable text, letters, numbers, logos, ETF tickers, watermarks, UI screenshots, or charts with readable labels.',
    'Keep the lower 38 percent dark, calm, simple, and uncluttered for Korean captions.',
    'Stable camera, no motion blur, no clutter, cinematic warm finance-documentary lighting.',
  ].join(' ');
  const scenes = [
    ['배당률 10%', '진짜 믿어도 될까?', '혹하는 질문', '#ffe200', '커버드콜 ETF를 보면 가장 먼저 눈에 들어오는 숫자가 있습니다. 배당률 십 퍼센트. 은행 이자보다 훨씬 커 보이고, 매달 돈이 들어온다고 하면 솔직히 혹할 수밖에 없습니다.', 'A Korean beginner investor pauses in front of a glowing but unreadable high-yield sign, tempted by falling coin lights, with the panda teacher small in the background watching cautiously.'],
    ['첫 번째 반전', '배당이 아니라 분배금', '용어 정리', '#ffcf48', '그런데 여기서 먼저 단어부터 정리해야 합니다. 커버드콜 ETF에서 받는 돈은 보통 배당이라기보다 분배금에 가깝습니다. 주식 배당, 이자, 옵션 프리미엄 등이 섞여 나올 수 있습니다.', 'A clean desk with three abstract streams of coins flowing into one basket, a Korean office worker looks curious while the panda teacher points with a small pointer.'],
    ['커버드콜 구조', '쉽게 말하면 보험료', '핵심 원리', '#63e7ff', '커버드콜은 아주 쉽게 말하면 내가 가진 주식 위에 일정한 권리를 팔고, 그 대가로 프리미엄을 받는 구조입니다. 그래서 시장이 가만히 있거나 조금 움직일 때는 현금흐름이 좋아 보일 수 있습니다.', 'A simple covered basket metaphor: a protective cloth over stock-like blocks and small premium coins falling beside it, no text, panda teacher explaining to a beginner.'],
    ['왜 많이 줄까', '공짜 돈은 아니다', '중요 반전', '#ff8a4f', '중요한 건 이 돈이 하늘에서 떨어지는 돈이 아니라는 점입니다. 옵션 프리미엄을 받는 대신, 시장이 크게 오를 때 일부 상승 기회를 포기할 수 있습니다.', 'A split scene with one side receiving steady coins and the other side a rising road moving away, a young investor stands between both paths.'],
    ['상승장 함정', '오를 때 덜 오른다', '놓치는 수익', '#ff4f67', '예를 들어 시장이 크게 상승하면 일반 지수 ETF는 시원하게 따라갈 수 있습니다. 하지만 커버드콜 ETF는 구조에 따라 상승분 일부가 제한될 수 있습니다. 배당률만 보면 이 부분이 잘 안 보입니다.', 'A bright uphill market road with a fast train passing while another slower cashflow cart moves steadily, no readable signs, human investor watching.'],
    ['하락장 착각', '배당이 방어막은 아님', '리스크 장면', '#ff5a70', '반대로 시장이 하락할 때도 조심해야 합니다. 분배금을 받는다고 해서 원금 하락이 사라지는 것은 아닙니다. 계좌 전체로 보면 분배금과 가격 변동을 합쳐서 봐야 합니다.', 'A rainy city market scene with a basket receiving coins while the floor slopes downward, worried Korean couple at a table, panda teacher holding an umbrella.'],
    ['분배율 착시', '수익률과 다르다', '숫자 함정', '#ffe200', '초보자가 가장 많이 헷갈리는 부분이 바로 분배율입니다. 분배율이 높다는 말은 많이 나눠준다는 뜻이지, 내가 실제로 많이 벌었다는 뜻은 아닙니다.', 'A shiny pile of coins in the foreground and a shadowed shrinking investment basket behind it, a magnifying glass held by a human hand, no text.'],
    ['원금 환급 가능성', '내 돈일 수도 있다', '꼭 확인', '#ff4f67', '일부 상품은 분배금 안에 원금이 일부 돌아오는 성격이 섞일 수 있습니다. 겉으로는 돈을 받는 것 같지만, 실제로는 내 투자금 일부를 다시 받는 느낌일 수 있습니다.', 'Two bowls on a desk receiving coins: one from income stream, one from the original basket, no labels; panda teacher looks serious beside a beginner investor.'],
    ['월 100만 원?', '필요 원금은 크다', '현실 계산', '#ffcf48', '배당률 십 퍼센트라는 말만 보면 적은 돈으로도 월 백만 원이 가능할 것처럼 느껴집니다. 하지만 세금, 환율, 가격 변동까지 생각하면 필요한 원금과 감당해야 할 흔들림은 생각보다 큽니다.', 'A realistic Korean home desk with many coin stacks, blank calculator, household budget envelopes, a person looking surprised; panda teacher is small beside the desk.'],
    ['세금과 환율', '받는 돈은 줄어든다', '체감 수익', '#63e7ff', '해외 커버드콜 ETF라면 세금과 환율도 봐야 합니다. 달러로는 같은 분배금이어도 원화로 바꾸면 체감이 달라질 수 있고, 세후 금액은 더 줄어들 수 있습니다.', 'A currency exchange scale with abstract coins, tax filter funnel, Korean investor holding a wallet, no symbols or readable letters.'],
    ['장기 성장', '대가가 있다', '기회비용', '#ff8a4f', '커버드콜 ETF는 현금흐름을 앞당겨 받는 느낌이 강합니다. 대신 장기 성장에서 일반 지수 ETF보다 아쉬울 수 있습니다. 지금 받는 돈과 미래 성장 사이의 교환입니다.', 'A time-lapse style scene: one hand receives coins now while a distant tree grows taller on another path, office worker looking thoughtful.'],
    ['맞는 사람', '현금흐름이 목적이면', '활용법', '#7cffb2', '그렇다고 커버드콜 ETF가 무조건 나쁘다는 뜻은 아닙니다. 은퇴 후 현금흐름이 필요하거나, 포트폴리오 일부에서 정기적인 분배를 원하는 사람에게는 도구가 될 수 있습니다.', 'A calm retired Korean person planning monthly expenses at a table with simple envelopes and coins, warm light, panda teacher gently assisting.'],
    ['안 맞는 사람', '성장이 최우선이면', '주의 대상', '#ff8a4f', '하지만 투자 기간이 길고 장기 성장이 최우선이라면 커버드콜 ETF가 항상 정답은 아닐 수 있습니다. 높은 분배율보다 내 목표가 먼저입니다.', 'A young investor comparing two clean paths: a cashflow coin path and a growth tree path, panda teacher standing aside, no text.'],
    ['체크 3가지', '무엇을 꼭 볼까', '실전 기준', '#63e7ff', '초보자는 커버드콜 ETF를 볼 때 세 가지를 먼저 확인하면 됩니다. 무엇을 담고 있는지, 옵션 전략이 얼마나 강한지, 분배금이 계속 유지 가능한 구조인지입니다.', 'Three blank checklist cards with icon-only symbols beside a simple ETF basket, Korean beginner investor and panda teacher reviewing them.'],
    ['JEPI와 JEPQ?', '이름보다 구조', '비교 관점', '#ffe200', '유명한 상품 이름을 외우는 것보다 중요한 건 구조입니다. 주식형인지, 나스닥 중심인지, 옵션을 얼마나 쓰는지에 따라 움직임이 완전히 달라집니다.', 'A clean comparison table made of blank cards with different abstract baskets, no ticker text, a finance classroom mood with several Korean viewers.'],
    ['전부 넣지 말자', '비중 관리가 먼저', '초보 원칙', '#ffcf48', '초보자라면 커버드콜 ETF에 전부 넣기보다 포트폴리오 일부로 보는 편이 현실적입니다. 현금흐름, 성장, 안정 자산을 나눠야 흔들릴 때 버틸 수 있습니다.', 'A balanced portfolio tray divided into sections: cashflow coins, growth tree, stable stones, with human hands arranging pieces; panda teacher small in corner.'],
    ['좋은 질문', '얼마나 주나보다', '핵심 전환', '#7cffb2', '이제 질문을 바꿔야 합니다. 얼마나 주느냐보다, 왜 주는지부터 봐야 합니다. 이유를 알면 높은 숫자에 덜 흔들리고, 내게 맞는지 판단할 수 있습니다.', 'A large question-mark-shaped light made from coins above a calm desk, beginner investor looks more confident, panda teacher points to the source of coins.'],
    ['팬더쌤 결론', '고배당은 마법 아님', '짧은 결론', '#ffe200', '결론입니다. 커버드콜 ETF의 높은 분배율은 매력적이지만 마법은 아닙니다. 현금흐름을 얻는 대신 포기하는 것도 있습니다. 그래서 배당률만 보고 믿으면 위험합니다.', 'Panda teacher in a warm classroom, standing beside a toolbox and an investment basket, serious but friendly conclusion mood.'],
    ['마지막 한 문장', '숫자보다 구조', '기억할 말', '#b5ff65', '초보자라면 이렇게 기억하면 됩니다. 커버드콜 ETF는 많이 주는 상품이 아니라, 구조를 이해하고 일부로 쓰는 상품입니다. 숫자보다 구조가 먼저입니다.', 'Hopeful closing scene with a clear road from tempting coin lights to a calm understanding map, Korean beginner investor walking with confidence, panda teacher waving in background.'],
  ].map(([title, subtitle, card, accent, narration, visualCue], index) => ({
    title,
    subtitle,
    card,
    accent,
    narration,
    durationSec: 9,
    visual: `covered_call_${String(index + 1).padStart(2, '0')}`,
    imagePrompt: `${baseRules} Scene ${index + 1} of 19: ${visualCue}`,
  }));

  return {
    ticker: 'COVERED-CALL-ETF',
    slug: 'covered-call-etf-10-percent-panda',
    outputBase: 'covered-call-etf-10-percent-panda',
    title: '커버드콜 ETF, 배당률 10% 믿어도 될까?',
    description: '커버드콜 ETF의 높은 분배율이 왜 나오는지, 상승장 제한과 분배율 착시, 원금 변동, 세금과 환율 리스크를 ETF 초보자도 이해하기 쉽게 정리합니다.',
    hookQuestion: '커버드콜 ETF 배당률 10%, 진짜 믿어도 될까?',
    openingFact: '높은 분배율은 매력적이지만, 커버드콜 ETF는 현금흐름과 상승 여력 사이의 교환을 이해해야 합니다.',
    tags: ['커버드콜ETF', '월배당ETF', '배당ETF', 'ETF초보', 'JEPI', 'JEPQ', 'QYLD', '분배율', '투자초보', '팬더선생'],
    thumbnailText: ['배당률 10%', '믿어도 될까', '커버드콜 함정'],
    thumbnailEyebrow: '커버드콜 ETF',
    thumbnailSentence: '배당률만 믿으면 위험',
    thumbnailSticker: '초보 필수',
    thumbnailSourceScene: 1,
    disclosure: '본 영상은 투자 권유가 아니며 특정 ETF 매수·매도를 추천하지 않습니다. 커버드콜 ETF의 구조와 위험을 이해하기 위한 정보 제공용 콘텐츠입니다.',
    format: 'browser-longform',
    aspect: '16:9',
    assetDir: 'out/ai-scenes-covered-call-etf-10-percent-panda',
    thumbnailFile: 'thumbnail-covered-call-etf-10-percent-panda.jpg',
    character: {
      name: '팬더 선생',
      consistencyPrompt: character,
    },
    scenes,
  };
}

async function main() {
  const plan = buildCoveredCallEtfPlan();
  const assetDir = path.join(outDir, 'ai-scenes-covered-call-etf-10-percent-panda');
  mkdirSync(assetDir, { recursive: true });

  const baseImage = existsSync(path.join(outDir, 'thumbnail-monthly-dividend-etf-paycheck-panda.jpg'))
    ? path.join(outDir, 'thumbnail-monthly-dividend-etf-paycheck-panda.jpg')
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
  writeFileSync(path.join(outDir, 'covered-call-etf-10-percent-panda-plan.json'), payload);
  console.log(`Wrote ${path.join(outDir, 'covered-call-etf-10-percent-panda-plan.json')}`);
  console.log(`Wrote placeholder scenes to ${assetDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

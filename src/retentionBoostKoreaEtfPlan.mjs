import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { outDir } from './config.mjs';

const sourcePlanPath = path.join(outDir, 'browser-longform-plan.json');
const boostedPlanPath = path.join(outDir, 'browser-longform-plan.json');

function loadPlan() {
  if (!existsSync(sourcePlanPath)) throw new Error(`Missing ${sourcePlanPath}`);
  const data = JSON.parse(readFileSync(sourcePlanPath, 'utf8'));
  return data.plan || data;
}

function sceneImagePrompt(scene, plan, visualCue) {
  const character = plan.character?.consistencyPrompt || 'same cute panda teacher character, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression';
  return [
    '16:9 high-quality Korean financial documentary illustration, soft 3D animated documentary style.',
    visualCue,
    `Recurring character: ${character}.`,
    'The panda teacher looks friendly but serious, explaining one clear idea to beginner investors.',
    'Keep composition simple: one main symbolic object, one panda teacher, no clutter.',
    'Leave the lower 38 percent of the frame dark, clean, calm, and uncluttered for Korean subtitles and title overlays.',
    `Narrative cue: ${scene.title} / ${scene.subtitle}.`,
    'No readable text, no Korean or English letters, no numbers, no ETF tickers, no logos, no watermark, no UI screens, no complex charts.',
  ].join(' ');
}

function boostPlan(plan) {
  const boosted = structuredClone(plan);
  boosted.slug = 'korea-etf-beginner-top5-retention';
  boosted.title = 'ETF 처음이면 이 5개부터 보세요, 그냥 사면 위험합니다';
  boosted.description = '국내 ETF를 처음 사려는 초보 투자자가 수익률만 보고 따라 사기 전에 알아야 할 대표 ETF 5개의 역할과 함정을 쉽게 정리한 영상입니다.';
  boosted.hookQuestion = '초보자가 ETF를 처음 살 때, 왜 수익률 높은 것부터 보면 위험할까?';
  boosted.openingFact = 'ETF는 쉬워 보이지만, 같은 이름처럼 보여도 시장대표, 성장주, 테마, 현금형의 위험이 완전히 다릅니다.';
  boosted.thumbnailText = ['ETF 처음이면', '이 5개만', '모르면 손해'];
  boosted.outputBase = 'korea-etf-beginner-top5-retention';
  boosted.disclosure = '본 영상은 투자 권유가 아니며, 특정 ETF의 매수·매도를 추천하지 않습니다. 초보자가 ETF의 역할과 위험을 이해하기 위한 정보 제공용 콘텐츠입니다.';

  const scenes = [
    {
      title: 'ETF 처음 살 때',
      subtitle: '수익률부터 보면 위험',
      narration: '초보자가 ETF를 처음 살 때 가장 많이 하는 실수가 있습니다. 이름이 익숙하거나, 최근 수익률이 높거나, 사람들이 많이 산다는 이유로 바로 따라 사는 겁니다. 그런데 ETF는 좋아 보이는 이름보다 역할이 먼저입니다. 오늘은 국장에서 처음 보면 좋은 ETF 다섯 개를 보되, 그냥 사면 어디서 위험해지는지까지 같이 보겠습니다.',
      visual: 'panda_hook_risk',
      imagePrompt: '어두운 투자 서재에서 팬더 선생이 수많은 투자 바구니 앞에서 손을 들어 잠깐 멈추라는 제스처를 한다. 앞에는 너무 많은 선택지가 놓여 있고 분위기는 궁금하지만 차분하다.',
      durationSec: 28,
    },
    {
      title: 'ETF는 바구니다',
      subtitle: '이 비유 하나면 쉽다',
      narration: 'ETF는 어렵게 설명하면 끝이 없지만, 처음에는 바구니라고 생각하면 됩니다. 한 종목만 사는 게 아니라 여러 주식이나 자산이 담긴 바구니 하나를 사는 겁니다. 문제는 바구니마다 내용물이 완전히 다르다는 거예요. 한국 시장 바구니, 미국 시장 바구니, 성장주 바구니, 반도체 바구니, 현금 대기 바구니는 이름은 다 ETF지만 움직이는 이유가 다릅니다.',
      visual: 'basket_metaphor',
      imagePrompt: '밝은 교실에서 팬더 선생이 서로 다른 다섯 개의 바구니를 보여준다. 각 바구니에는 색과 질감이 다른 추상 구슬이 들어 있고 글자나 숫자는 없다.',
      durationSec: 27,
    },
    {
      title: '오늘의 기준',
      subtitle: '추천 순위가 아니다',
      narration: '오늘 순서는 수익률 순위도 아니고 매수 추천도 아닙니다. 초보자가 ETF의 역할을 이해하기 쉬운 순서입니다. 어떤 ETF는 시장 전체를 보고, 어떤 ETF는 특정 산업에 집중하고, 어떤 ETF는 잠깐 쉬어가는 돈의 자리에 가깝습니다. 이 차이를 모르면 좋은 상품을 골라도 내 계좌에서는 불편한 상품이 될 수 있습니다.',
      visual: 'criteria_map',
      imagePrompt: '팬더 선생이 둥근 테이블 위에 다섯 개 바구니를 지도처럼 배치하고 있다. 중심 바구니와 보조 바구니가 구분되지만 숫자나 글자는 없다.',
      durationSec: 25,
    },
    {
      title: '5위 금리형 ETF',
      subtitle: '안전해 보여도 예금 아님',
      narration: '다섯 번째는 CD금리액티브 같은 금리형 ETF입니다. 많은 초보자가 이걸 현금 대기처처럼 봅니다. 주식처럼 크게 오르는 걸 노린다기보다, 투자 타이밍을 기다리는 돈을 잠시 세워두는 느낌입니다. 하지만 여기서 함정이 있습니다. 예금이 아니고 원금 보장이 아닙니다. 금리 변화, 합성 구조, 보수와 괴리율을 꼭 확인해야 합니다.',
      visual: 'cash_etf_caution',
      imagePrompt: '조용한 금융 대기실에서 팬더 선생이 금고 옆의 차분한 바구니를 설명한다. 바구니는 안정적으로 보이지만 팬더 표정은 신중하다.',
      durationSec: 27,
    },
    {
      title: '4위 반도체 ETF',
      subtitle: '핫하지만 쏠림이 크다',
      narration: '네 번째는 국내 반도체 테마 ETF입니다. 한국 시장에서 반도체는 늘 관심이 큽니다. 그래서 반도체 ETF는 뉴스가 좋을 때 돈이 빠르게 몰릴 수 있습니다. 하지만 테마 ETF는 넓은 분산 상품이 아닙니다. 특정 업종에 집중되어 있어서 사이클이 꺾이면 하락도 빠를 수 있습니다. 핫하다는 말은 기회이기도 하지만, 쏠림이라는 뜻이기도 합니다.',
      visual: 'semiconductor_cycle',
      imagePrompt: '추상적인 반도체 연구실에서 팬더 선생이 빛나는 칩 모양 소품이 담긴 금속 바구니를 조심스럽게 가리킨다.',
      durationSec: 28,
    },
    {
      title: '3위 나스닥100',
      subtitle: '성장주는 빠르게 흔들림',
      narration: '세 번째는 미국나스닥100 ETF입니다. AI, 빅테크, 성장주 흐름을 보고 싶은 사람에게는 매우 직관적입니다. 그래서 초보자도 쉽게 끌립니다. 그런데 성장주 ETF는 좋을 때만 빠른 게 아닙니다. 금리 부담이나 실적 우려가 생기면 하락도 빠르게 옵니다. 멋있어 보인다는 이유만으로 비중을 크게 잡으면, 첫 조정장에서 버티기 어려울 수 있습니다.',
      visual: 'growth_volatility',
      imagePrompt: '미래형 연구실에서 팬더 선생이 빛나는 기술 구슬 바구니를 바라본다. 배경은 세련되지만 조명은 약간 긴장감이 있다.',
      durationSec: 29,
    },
    {
      title: '2위 S&P500',
      subtitle: '미국 전체를 사는 느낌',
      narration: '두 번째는 미국S&P500 ETF입니다. 국내 계좌로 미국 대표 기업들에 넓게 투자하는 가장 쉬운 방법 중 하나입니다. 초보자에게 좋은 이유는 설명이 쉽다는 겁니다. 미국 경제의 큰 바구니를 사는 느낌이죠. 하지만 원화로 매수해도 안에는 미국 자산이 들어 있습니다. 그래서 미국 증시뿐 아니라 환율까지 같이 흔들릴 수 있습니다.',
      visual: 'sp500_global_core',
      imagePrompt: '팬더 선생이 다리 위에서 바다 건너 부드럽게 빛나는 글로벌 도시를 바라본다. 앞에는 세계 지도 느낌의 바구니가 놓여 있다.',
      durationSec: 28,
    },
    {
      title: '1위 KODEX 200',
      subtitle: '한국 시장의 기본 바구니',
      narration: '첫 번째는 KODEX 200처럼 한국 대표 시장을 보는 ETF입니다. 한국 주식시장에 처음 접근한다면 교과서 같은 바구니입니다. 한국 대형주 흐름을 한 번에 볼 수 있고 구조도 비교적 이해하기 쉽습니다. 하지만 대표 상품이라는 말이 안전하다는 뜻은 아닙니다. 한국 시장이 부진하면 이 ETF도 같이 부진하고, 대형주 비중의 영향을 크게 받습니다.',
      visual: 'kospi_core_caution',
      imagePrompt: '한국 도시의 대형 빌딩 숲을 배경으로 팬더 선생이 크고 안정적인 바구니를 가리킨다. 아침 빛이 들어오지만 표정은 차분하다.',
      durationSec: 28,
    },
    {
      title: '진짜 함정',
      subtitle: '이름이 비슷해도 구조가 다름',
      narration: '여기서 진짜 함정이 나옵니다. 같은 S&P500처럼 보여도 운용사, 환헤지 여부, TR 구조, 분배 방식, 보수, 세금이 다를 수 있습니다. 이름만 보고 같은 상품이라고 생각하면 안 됩니다. 사기 전에는 세 가지를 확인하세요. 무엇을 따라가는지, 실제 비용은 얼마인지, 그리고 내 계좌에서 세금과 분배금이 어떻게 처리되는지입니다.',
      visual: 'hidden_structure',
      imagePrompt: '팬더 선생이 비슷해 보이는 여러 개의 닫힌 바구니 앞에서 돋보기를 들고 있다. 바구니는 비슷하지만 안쪽 그림자는 서로 다르다.',
      durationSec: 30,
    },
    {
      title: '결론',
      subtitle: '좋은 ETF보다 맞는 ETF',
      narration: '정리하면 ETF 초보자에게 중요한 건 인기 순위를 외우는 게 아닙니다. 내 돈이 어떤 역할의 바구니에 들어가는지 설명할 수 있어야 합니다. 시장 대표는 중심축, 성장주는 공격수, 테마는 기회와 위험, 금리형은 잠깐 쉬어가는 자리로 보면 훨씬 쉽습니다. 좋은 ETF를 찾기 전에, 이 ETF가 내 목적에 맞는지 먼저 말할 수 있어야 합니다.',
      visual: 'closing_framework',
      imagePrompt: '밤의 조용한 교실에서 팬더 선생이 다섯 개의 바구니를 정리해 놓고 시청자를 향해 차분하게 마무리한다.',
      durationSec: 29,
    },
  ];

  boosted.scenes = scenes.map((scene) => ({
    ...scene,
    imagePrompt: sceneImagePrompt(scene, boosted, scene.imagePrompt),
  }));

  return boosted;
}

const boosted = boostPlan(loadPlan());
writeFileSync(boostedPlanPath, `${JSON.stringify({ plan: boosted }, null, 2)}\n`);
writeFileSync(path.join(outDir, `${boosted.slug}-plan.json`), `${JSON.stringify({ plan: boosted }, null, 2)}\n`);
console.log(`Saved boosted plan: ${boostedPlanPath}`);
console.log(`Slug: ${boosted.slug}`);

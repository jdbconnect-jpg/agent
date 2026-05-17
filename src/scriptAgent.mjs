import { writeFileSync } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { config, outDir } from './config.mjs';
import { formatKrw } from './finance.mjs';

const fallbackScenes = (snapshot) => [
  {
    title: 'JEPQ 말고',
    subtitle: '이 ETF를 보는 이유',
    narration: 'JEPQ가 월배당으로 눈길을 끈다면, 오늘은 반대로 덜 자극적인 ETF 하나를 보겠습니다. 바로 SCHD입니다.',
    durationSec: 7,
    visual: 'hook',
  },
  {
    title: '배당률은 낮다',
    subtitle: `현재 기준 ${(snapshot.annualYield * 100).toFixed(2)}%`,
    narration: `SCHD의 배당률은 현재 기준 약 ${(snapshot.annualYield * 100).toFixed(2)}퍼센트입니다. JEPQ처럼 숫자가 확 튀지는 않습니다. 여기서 많은 사람이 바로 실망합니다.`,
    durationSec: 9,
    visual: 'conflict',
  },
  {
    title: '진짜 포인트',
    subtitle: '배당 성장',
    narration: '그런데 SCHD를 보는 이유는 오늘 배당이 아니라, 배당을 오래 늘려온 기업들을 골라 담는 구조에 있습니다. 월급처럼 크게 주는 ETF가 아니라, 시간이 필요한 ETF입니다.',
    durationSec: 10,
    visual: 'number',
  },
  {
    title: '월 100만?',
    subtitle: `세후 ${formatKrw(snapshot.netPrincipalKrw)}`,
    narration: `그래도 숫자는 냉정합니다. 세후로 월 백만 원 수준의 현금흐름을 기대하려면, 현재 배당률 기준으로 약 ${formatKrw(snapshot.netPrincipalKrw)}이 필요합니다.`,
    durationSec: 9,
    visual: 'number',
  },
  {
    title: '함정도 있다',
    subtitle: '분기 배당 · 원금 변동',
    narration: '하지만 함정도 있습니다. SCHD는 매월 배당이 아니라 보통 분기 배당이고, 주식형 ETF라 원금은 당연히 흔들립니다. 배당 성장도 보장되는 숫자가 아닙니다.',
    durationSec: 10,
    visual: 'risk',
  },
  {
    title: '결론',
    subtitle: '현금흐름보다 체력',
    narration: '결론입니다. 당장 월배당이 목표라면 SCHD는 심심할 수 있습니다. 하지만 오래 들고 갈 배당 성장 ETF를 찾는다면, JEPQ와는 다른 이유로 꼭 비교해볼 만합니다.',
    durationSec: 9,
    visual: 'close',
  },
];

const longformScenes = (snapshot) => [
  {
    title: 'JEPQ 말고 SCHD',
    subtitle: '왜 비교할까?',
    narration: [
      '오늘은 JEPQ처럼 월배당이 강한 ETF가 아니라, 조금 더 심심해 보이는 SCHD를 3분에서 5분 안에 차분하게 보겠습니다.',
      '이 영상의 핵심 질문은 하나입니다. 당장 배당률이 더 높은 ETF가 많은데, 왜 어떤 투자자들은 SCHD를 계속 비교 후보에 올릴까요?',
      '결론부터 말하면 SCHD는 빠르게 현금흐름을 뽑아내는 ETF라기보다, 배당을 꾸준히 늘려온 기업들을 모아 장기 체력을 보는 ETF에 가깝습니다.',
      '그래서 오늘은 좋다는 말만 하지 않고, 숫자와 함정을 같이 보겠습니다. 투자 권유가 아니라, 판단을 위한 기준 정리입니다.',
    ].join(' '),
    durationSec: 32,
    visual: 'hook',
  },
  {
    title: '첫 번째 차이',
    subtitle: '높은 배당률이 아님',
    narration: [
      `현재 계산에는 SCHD의 배당 수익률을 약 ${(snapshot.annualYield * 100).toFixed(2)}퍼센트로 잡았습니다.`,
      '이 숫자만 보면 솔직히 강한 자극은 없습니다. JEPQ나 다른 커버드콜 ETF처럼 8퍼센트, 10퍼센트에 가까운 숫자를 기대한 분이라면 조금 실망할 수 있습니다.',
      '그런데 바로 이 지점이 중요합니다. 높은 배당률은 매력적이지만, 그 배당이 어떤 방식으로 만들어지는지에 따라 성격이 완전히 달라집니다.',
      'SCHD는 오늘 많이 주는 느낌보다, 시간이 지나며 배당을 늘릴 수 있는 기업을 담는 쪽에 더 가깝습니다.',
    ].join(' '),
    durationSec: 31,
    visual: 'conflict',
  },
  {
    title: '진짜 포인트',
    subtitle: '배당 성장',
    narration: [
      'SCHD를 보는 핵심 단어는 배당 성장입니다. 단순히 배당을 많이 주는 기업이 아니라, 재무 체력과 현금흐름을 바탕으로 배당을 유지하고 늘려온 기업을 선별한다는 점이 포인트입니다.',
      '물론 과거에 배당을 늘렸다고 앞으로도 무조건 늘어난다는 뜻은 아닙니다.',
      '하지만 투자자가 SCHD를 비교하는 이유는 배당률 하나가 아닙니다. 배당이 줄어들 가능성, 주가 변동성, 장기 보유했을 때의 회복력까지 같이 보는 겁니다.',
      '한마디로 월급처럼 당장 크게 받는 ETF와, 시간이 필요한 배당 성장 ETF는 목적이 다릅니다.',
    ].join(' '),
    durationSec: 34,
    visual: 'number',
  },
  {
    title: '월 100만 원',
    subtitle: `세후 ${formatKrw(snapshot.netPrincipalKrw)}`,
    narration: [
      `그럼 사람들이 가장 궁금해하는 숫자로 가보겠습니다. 세후로 월 백만 원 정도의 현금흐름을 기대하려면, 현재 배당률과 미국 원천징수세 ${(snapshot.taxRate * 100).toFixed(0)}퍼센트를 반영했을 때 필요한 원금은 약 ${formatKrw(snapshot.netPrincipalKrw)}입니다.`,
      '이 숫자를 보면 바로 느낌이 오죠. SCHD는 적은 돈으로 월 백만 원을 만들어주는 ETF가 아닙니다.',
      '오히려 월 백만 원이라는 목표를 SCHD 하나로만 맞추려면 원금 부담이 꽤 큽니다.',
      '그래서 SCHD는 단기 현금흐름용이라기보다, 장기 배당 성장 포트폴리오의 한 축으로 보는 게 더 자연스럽습니다.',
    ].join(' '),
    durationSec: 35,
    visual: 'number',
  },
  {
    title: '두 번째 함정',
    subtitle: '월배당이 아님',
    narration: [
      '여기서 꼭 조심해야 할 점이 있습니다. SCHD는 보통 월배당 ETF가 아니라 분기 배당 ETF입니다.',
      '매달 따박따박 들어오는 현금흐름을 기대한다면, 체감은 JEPQ 같은 월배당 ETF와 다릅니다.',
      '예를 들어 생활비를 매월 배당으로 맞추려는 사람은 분기마다 들어오는 배당을 월 단위로 나누어 관리해야 합니다.',
      '즉 SCHD는 현금흐름이 없는 ETF는 아니지만, 월급처럼 매달 같은 금액이 들어오는 구조는 아닙니다.',
    ].join(' '),
    durationSec: 31,
    visual: 'risk',
  },
  {
    title: '세 번째 함정',
    subtitle: '원금도 흔들린다',
    narration: [
      '그리고 더 중요한 함정은 원금입니다. 배당 ETF라는 말 때문에 예금처럼 생각하면 안 됩니다.',
      'SCHD도 결국 주식형 ETF입니다. 시장이 하락하면 평가금액은 당연히 흔들리고, 경기 상황에 따라 구성 종목의 실적도 영향을 받습니다.',
      '배당이 있다고 해서 손실이 사라지는 것은 아닙니다. 배당을 받는 동안 주가가 더 크게 빠질 수도 있습니다.',
      '그래서 배당률보다 먼저 봐야 할 것은 내가 그 변동성을 버틸 수 있는가입니다.',
    ].join(' '),
    durationSec: 33,
    visual: 'risk',
  },
  {
    title: '어울리는 사람',
    subtitle: '장기 투자자',
    narration: [
      '그렇다면 SCHD는 어떤 사람에게 더 어울릴까요? 첫째, 당장 높은 월배당보다 장기 배당 성장을 보고 싶은 사람입니다.',
      '둘째, 한 번에 큰 수익률을 노리기보다 꾸준히 모아가며 포트폴리오를 만들고 싶은 사람입니다.',
      '셋째, 배당을 재투자하면서 시간을 내 편으로 만들고 싶은 사람입니다.',
      '반대로 매달 높은 현금흐름이 최우선인 사람에게는 SCHD가 답답하게 느껴질 수 있습니다.',
    ].join(' '),
    durationSec: 30,
    visual: 'close',
  },
  {
    title: '결론',
    subtitle: '배당률보다 목적',
    narration: [
      '정리하겠습니다. SCHD는 높은 배당률 하나로 사람을 혹하게 만드는 ETF는 아닙니다.',
      `현재 기준으로 세후 월 백만 원을 기대하려면 약 ${formatKrw(snapshot.netPrincipalKrw)}이라는 큰 원금이 필요하고, 월배당도 아니며, 원금 변동도 있습니다.`,
      '하지만 장기적으로 배당 성장과 주식형 자산의 체력을 같이 보고 싶다면, JEPQ와는 완전히 다른 이유로 비교해볼 만한 ETF입니다.',
      '중요한 건 어떤 ETF가 무조건 좋다 나쁘다가 아닙니다. 내 목표가 월 현금흐름인지, 장기 성장인지, 그리고 내가 버틸 수 있는 변동성이 어디까지인지 먼저 정하는 겁니다.',
    ].join(' '),
    durationSec: 36,
    visual: 'close',
  },
];

const documentaryScenes = (snapshot) => [
  {
    title: '월배당의 유혹',
    subtitle: '사람들이 JEPQ에 끌리는 이유',
    narration: [
      '배당 ETF를 처음 볼 때 가장 강한 단어는 월배당입니다. 매달 통장에 돈이 들어온다는 말은 생각보다 강합니다.',
      '특히 JEPQ처럼 배당률이 높아 보이는 상품을 보면, 사람들은 자연스럽게 이런 질문을 합니다. 이걸로 월 백만 원을 만들 수 있을까?',
      '그런데 오늘은 그 질문에서 한 걸음 옆으로 가보겠습니다. 월배당은 매력적이지만, 장기적으로 내 돈을 지키고 키우는 관점에서는 다른 후보도 봐야 합니다.',
      '그래서 오늘의 주인공은 SCHD입니다. 화려하진 않지만, 사람들이 계속 비교하는 이유가 있습니다.',
    ].join(' '),
    durationSec: 34,
    visual: 'temptation',
  },
  {
    title: '겉보기 숫자',
    subtitle: '배당률만 보면 심심하다',
    narration: [
      `현재 계산에는 SCHD의 배당 수익률을 약 ${(snapshot.annualYield * 100).toFixed(2)}퍼센트로 잡았습니다.`,
      '솔직히 이 숫자만 보면 자극적이지 않습니다. 커버드콜 ETF의 높은 배당률을 보던 사람에게는 너무 낮아 보일 수 있습니다.',
      '하지만 여기서 중요한 반전이 나옵니다. 배당률이 낮다는 말이 무조건 나쁘다는 뜻은 아닙니다.',
      '오히려 왜 낮은지, 그 배당이 어떤 기업에서 나오는지, 시간이 지나며 커질 가능성이 있는지를 봐야 합니다.',
    ].join(' '),
    durationSec: 33,
    visual: 'yield',
  },
  {
    title: '진짜 비교점',
    subtitle: '많이 주는 ETF vs 오래 가는 ETF',
    narration: [
      'JEPQ와 SCHD는 같은 배당 ETF처럼 보이지만 성격이 다릅니다.',
      'JEPQ는 높은 현금흐름을 기대하는 사람이 먼저 보게 되는 상품이고, SCHD는 배당 성장과 기업 체력을 같이 보려는 사람이 비교하는 상품입니다.',
      '월세처럼 매달 크게 받는 느낌을 원한다면 SCHD는 답답할 수 있습니다.',
      '하지만 배당이 오래 유지될 수 있는지, 시간이 지나며 늘어날 수 있는지를 보고 싶다면 이야기가 달라집니다.',
    ].join(' '),
    durationSec: 34,
    visual: 'compare',
  },
  {
    title: '숫자의 현실',
    subtitle: `세후 월 100만 원 = 약 ${formatKrw(snapshot.netPrincipalKrw)}`,
    narration: [
      `이제 가장 현실적인 숫자를 보겠습니다. 세후로 월 백만 원 정도의 배당 현금흐름을 기대한다면, 현재 배당률과 미국 원천징수세 ${(snapshot.taxRate * 100).toFixed(0)}퍼센트를 반영했을 때 필요한 원금은 약 ${formatKrw(snapshot.netPrincipalKrw)}입니다.`,
      '이 숫자는 많은 사람에게 찬물을 끼얹습니다. SCHD는 적은 돈으로 생활비를 바로 만들어주는 상품이 아닙니다.',
      '그래서 이 ETF를 볼 때는 월 백만 원이라는 목표보다, 장기적으로 배당과 자산을 함께 키우는 구조인지 먼저 봐야 합니다.',
    ].join(' '),
    durationSec: 36,
    visual: 'calculation',
  },
  {
    title: '숨은 함정 1',
    subtitle: '월급처럼 들어오지 않는다',
    narration: [
      '첫 번째 함정은 배당 주기입니다. SCHD는 보통 월배당 ETF가 아니라 분기 배당 ETF입니다.',
      '매달 같은 날짜에 같은 금액이 들어오는 구조를 기대했다면 체감은 다를 수밖에 없습니다.',
      '생활비를 배당으로 맞추려면 분기마다 받은 돈을 월별로 나눠 관리해야 합니다.',
      '배당이 있다는 사실과, 그 배당이 월급처럼 쓰기 편하다는 사실은 전혀 다른 이야기입니다.',
    ].join(' '),
    durationSec: 32,
    visual: 'calendar',
  },
  {
    title: '숨은 함정 2',
    subtitle: '배당이 원금 손실을 지워주진 않는다',
    narration: [
      '두 번째 함정은 원금입니다. 배당 ETF라는 이름 때문에 예금처럼 느끼면 위험합니다.',
      'SCHD도 결국 주식형 ETF입니다. 시장이 흔들리면 평가금액도 흔들립니다.',
      '배당을 받는 동안 주가가 더 크게 빠질 수도 있고, 경기 상황에 따라 배당 성장 속도도 달라질 수 있습니다.',
      '그래서 좋은 ETF인지보다 먼저 물어야 할 질문은 이것입니다. 나는 이 변동성을 몇 년 동안 견딜 수 있는가.',
    ].join(' '),
    durationSec: 36,
    visual: 'risk',
  },
  {
    title: '결론',
    subtitle: 'SCHD는 빠른 돈보다 긴 시간에 가깝다',
    narration: [
      '정리하면 SCHD는 높은 월배당으로 사람을 혹하게 만드는 ETF가 아닙니다.',
      `세후 월 백만 원을 만들려면 약 ${formatKrw(snapshot.netPrincipalKrw)}이라는 큰 원금이 필요하고, 월배당도 아니며, 원금 변동도 있습니다.`,
      '하지만 장기 배당 성장, 기업 체력, 꾸준한 재투자를 보고 싶다면 JEPQ와는 다른 이유로 비교해볼 만합니다.',
      '결국 답은 ETF 이름에 있지 않습니다. 내 목표가 매달 현금흐름인지, 긴 시간의 배당 성장인지 먼저 정해야 합니다.',
    ].join(' '),
    durationSec: 38,
    visual: 'close',
  },
];

export const popularEtfResearchSnapshot = {
  asOf: '2026-05-17',
  theme: '최근 자금 흐름과 대중 관심 기준 인기 ETF TOP 5',
  caveat: '순위는 투자 추천이 아니라 최근 ETF 플로우, 대형 운용 ETF, 검색 관심을 영상용으로 재구성한 것입니다.',
  candidates: [
    {
      ticker: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      angle: '가장 평범하지만 돈이 계속 몰리는 대표 S&P 500 ETF',
      risk: '미국 대형주 쏠림과 시장 전체 하락 리스크',
    },
    {
      ticker: 'SPY',
      name: 'SPDR S&P 500 ETF Trust',
      angle: '거래량과 인지도가 큰 S&P 500 대표 ETF',
      risk: '장기 보유 비용은 비슷한 지수 ETF와 비교가 필요',
    },
    {
      ticker: 'QQQ',
      name: 'Invesco QQQ Trust',
      angle: 'AI와 빅테크 기대감이 몰리는 나스닥 100 ETF',
      risk: '기술주 집중도가 높아 조정장에 크게 흔들릴 수 있음',
    },
    {
      ticker: 'IBIT',
      name: 'iShares Bitcoin Trust ETF',
      angle: '비트코인 현물 ETF 중 관심과 자산 규모가 큰 상품',
      risk: '비트코인 가격 변동성이 그대로 반영됨',
    },
    {
      ticker: 'SGOV',
      name: 'iShares 0-3 Month Treasury Bond ETF',
      angle: '불확실할 때 현금 대기처처럼 보는 초단기 미국채 ETF',
      risk: '금리 하락 시 기대 수익률이 낮아질 수 있음',
    },
  ],
  sources: [
    'ETF.com daily and weekly fund-flow coverage in May 2026',
    'ETF.com January-April 2026 flow archive',
    'Bitcoin spot ETF flow trackers through mid-May 2026',
  ],
};

const pandaPopularEtfScenes = () => [
  {
    title: '요즘 돈 몰리는 ETF',
    subtitle: 'TOP 5를 그냥 사면 안 되는 이유',
    narration: [
      '오늘은 사람들이 요즘 가장 많이 궁금해하는 ETF 다섯 개를 보겠습니다.',
      '하지만 순위만 보고 따라 사는 영상은 아닙니다. 팬더 선생이 하나씩 왜 인기 있는지, 그리고 어디서 조심해야 하는지 아주 짧게 짚어보겠습니다.',
      '기준은 최근 ETF 자금 흐름과 투자자 관심입니다. 투자 추천이 아니라, 지금 시장의 관심 지도를 보는 영상입니다.',
    ].join(' '),
    durationSec: 25,
    visual: 'panda_hook',
  },
  {
    title: '5위 SGOV',
    subtitle: '불안할 때 현금 대기처',
    narration: [
      '먼저 SGOV입니다. 이 ETF는 초단기 미국 국채에 투자합니다.',
      '주식처럼 크게 오르는 상품은 아니지만, 시장이 불안할 때 현금을 잠깐 세워두는 대기실처럼 보는 사람들이 많습니다.',
      '다만 금리가 내려가면 기대 수익률도 낮아질 수 있습니다. 안전해 보인다는 말과 수익이 보장된다는 말은 다릅니다.',
    ].join(' '),
    durationSec: 25,
    visual: 'panda_cash',
  },
  {
    title: '4위 IBIT',
    subtitle: '비트코인을 ETF로 산다?',
    narration: [
      '다음은 IBIT입니다. 비트코인 현물 ETF 중에서 특히 관심이 큰 상품입니다.',
      '계좌에서 ETF처럼 거래할 수 있다는 점 때문에 접근성이 확 좋아졌습니다.',
      '하지만 본질은 비트코인 가격에 가깝습니다. 하루에도 크게 흔들릴 수 있고, 인기와 리스크가 같이 붙어 있는 ETF입니다.',
    ].join(' '),
    durationSec: 26,
    visual: 'panda_crypto',
  },
  {
    title: '3위 QQQ',
    subtitle: 'AI와 빅테크의 힘',
    narration: [
      '세 번째는 QQQ입니다. 나스닥 100을 따라가는 대표 ETF이고, AI와 빅테크 흐름을 이야기할 때 거의 빠지지 않습니다.',
      '사람들이 QQQ를 보는 이유는 간단합니다. 성장 기대감이 큽니다.',
      '반대로 조심할 점도 뚜렷합니다. 기술주 쏠림이 강하기 때문에 시장 분위기가 바뀌면 낙폭도 커질 수 있습니다.',
    ].join(' '),
    durationSec: 27,
    visual: 'panda_ai',
  },
  {
    title: '2위 SPY',
    subtitle: '가장 유명한 S&P 500',
    narration: [
      '두 번째는 SPY입니다. S&P 500을 대표하는 가장 유명한 ETF 중 하나입니다.',
      '거래량과 인지도가 크기 때문에 단기 투자자부터 기관까지 폭넓게 씁니다.',
      '하지만 장기 투자자는 비용도 비교해야 합니다. 같은 S&P 500이라도 운용보수와 목적이 조금씩 다를 수 있습니다.',
    ].join(' '),
    durationSec: 26,
    visual: 'panda_index',
  },
  {
    title: '1위 VOO',
    subtitle: '평범한데 강하다',
    narration: [
      '첫 번째는 VOO입니다. 화려한 테마 ETF는 아니지만, 최근에도 S&P 500 대표 ETF로 계속 언급됩니다.',
      '사람들이 VOO를 좋아하는 이유는 단순합니다. 낮은 비용, 넓은 분산, 그리고 미국 대형주에 한 번에 투자한다는 편리함입니다.',
      '하지만 이것도 무조건 안전한 건 아닙니다. 미국 대형주 시장이 흔들리면 VOO도 같이 흔들립니다.',
    ].join(' '),
    durationSec: 28,
    visual: 'panda_winner',
  },
  {
    title: '진짜 반전',
    subtitle: '인기 ETF가 정답은 아니다',
    narration: [
      '여기서 가장 중요한 반전입니다. 인기 있는 ETF가 내게 맞는 ETF라는 뜻은 아닙니다.',
      'VOO와 SPY는 시장 전체에 가깝고, QQQ는 성장주 성격이 강하고, IBIT는 변동성이 크고, SGOV는 현금 대기 성격이 강합니다.',
      '같은 ETF라는 이름을 달고 있어도 역할이 완전히 다릅니다.',
    ].join(' '),
    durationSec: 26,
    visual: 'panda_warning',
  },
  {
    title: '결론',
    subtitle: '순위보다 역할을 보세요',
    narration: [
      '정리하겠습니다. 요즘 관심이 큰 ETF를 보면 시장의 마음을 읽을 수는 있습니다.',
      '하지만 내 돈을 넣기 전에는 딱 하나를 먼저 정해야 합니다. 나는 성장, 안정, 현금 대기, 변동성 투자 중 무엇을 원하는가.',
      '순위는 출발점일 뿐이고, 진짜 선택은 내 목표와 리스크 감당 범위에서 시작됩니다.',
    ].join(' '),
    durationSec: 25,
    visual: 'panda_close',
  },
];

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['ticker', 'title', 'description', 'tags', 'thumbnailText', 'disclosure', 'scenes'],
  properties: {
    ticker: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    thumbnailText: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'string' } },
    disclosure: { type: 'string' },
    scenes: {
      type: 'array',
      minItems: 5,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'subtitle', 'narration', 'durationSec', 'visual'],
        properties: {
          title: { type: 'string' },
          subtitle: { type: 'string' },
          narration: { type: 'string' },
          durationSec: { type: 'number' },
          visual: { type: 'string', enum: ['hook', 'number', 'conflict', 'risk', 'close'] },
        },
      },
    },
  },
};

export async function generateVideoPlan(snapshot, { forceFallback = false } = {}) {
  if (!config.openaiApiKey || forceFallback) {
    const plan = {
      ticker: snapshot.ticker,
      title: 'SCHD, JEPQ 말고 볼 만한 배당 ETF일까? 숫자와 함정',
      description: [
        `JEPQ처럼 높은 월배당은 아니지만, SCHD를 왜 비교 후보로 보는지 숫자로 확인합니다.`,
        `계산 기준: SCHD 30일 SEC Yield ${(snapshot.annualYield * 100).toFixed(2)}%, USD/KRW ${snapshot.usdKrw.toFixed(2)}, 미국 원천징수세 ${(snapshot.taxRate * 100).toFixed(0)}%.`,
        '투자 권유가 아닌 정보 제공용 콘텐츠입니다.',
      ].join('\n'),
      tags: ['SCHD', 'JEPQ', '배당성장ETF', '미국ETF', '배당투자', '재테크'],
      thumbnailText: ['JEPQ 말고 SCHD?', '낮은 배당률의 반전', '진짜 원금 공개'],
      disclosure: '이 영상은 AI 음성과 자동 생성 그래픽을 포함하며 투자 권유가 아닙니다.',
      scenes: fallbackScenes(snapshot),
    };
    writeFileSync(path.join(outDir, 'video-plan.json'), JSON.stringify({ snapshot, plan }, null, 2));
    return plan;
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const response = await client.responses.create({
    model: config.openaiModel,
    instructions: [
      '너는 한국어 금융 유튜브 숏폼 작가다.',
      '레퍼런스 스타일: 큰 질문 훅, 반전/갈등, 숫자 공개, 함정 경고, 짧은 결론.',
      '투자 권유처럼 쓰지 말고, 계산 가정과 리스크를 명확히 포함한다.',
      '과장된 수익 보장 표현은 금지한다.',
    ].join('\n'),
    input: `SCHD를 JEPQ와 비교해 "다른 ETF 하나 추천할만한 것"처럼 보이지만 투자 권유가 아닌 60초 안팎 쇼츠용으로 구성해줘.\n계산 스냅샷: ${JSON.stringify(snapshot)}`,
    text: {
      format: {
        type: 'json_schema',
        name: 'youtube_video_plan',
        schema,
        strict: true,
      },
    },
  });

  const plan = JSON.parse(response.output_text);
  writeFileSync(path.join(outDir, 'video-plan.json'), JSON.stringify({ snapshot, plan }, null, 2));
  return plan;
}

export function generatePandaPopularEtfPlan({ source = 'local-fallback' } = {}) {
  const plan = {
    ticker: 'ETF TOP 5',
    title: '요즘 가장 관심 많은 ETF TOP 5, 그냥 따라 사면 위험한 이유',
    description: [
      '최근 ETF 자금 흐름과 투자자 관심을 바탕으로 사람들이 많이 보는 ETF TOP 5를 정리합니다.',
      'VOO, SPY, QQQ, IBIT, SGOV의 인기 이유와 조심할 점을 팬더 선생 콘셉트로 쉽게 설명합니다.',
      '투자 권유가 아닌 정보 제공용 콘텐츠입니다.',
    ].join('\n'),
    tags: ['ETF', '미국ETF', 'VOO', 'SPY', 'QQQ', 'IBIT', 'SGOV', 'ETF추천아님', '재테크'],
    thumbnailText: ['ETF TOP 5', '요즘 돈 몰리는 곳', '따라 사면 위험?'],
    disclosure: '이 영상은 AI 음성과 자동 생성 삽화를 포함하며 투자 권유가 아닙니다.',
    format: 'panda-documentary',
    aspect: '16:9',
    character: {
      name: '팬더 선생',
      consistencyPrompt: 'same cute panda teacher character in every scene: small round panda, black round glasses, mint green bow tie, beige cardigan, tiny wooden pointer, warm friendly expression, standing beside simple finance props',
    },
    research: popularEtfResearchSnapshot,
    generatedBy: source,
    scenes: pandaPopularEtfScenes(),
  };
  writeFileSync(path.join(outDir, 'video-plan-panda-top-etfs.json'), JSON.stringify({ plan }, null, 2));
  writeFileSync(path.join(outDir, 'video-plan.json'), JSON.stringify({ plan }, null, 2));
  return plan;
}

export async function generateLongformVideoPlan(snapshot) {
  const plan = {
    ticker: snapshot.ticker,
    title: 'SCHD 장기투자 전에 꼭 봐야 할 숫자와 함정',
    description: [
      'SCHD가 JEPQ와 다른 이유를 3~5분 분량으로 정리합니다.',
      `계산 기준: SCHD 30일 SEC Yield ${(snapshot.annualYield * 100).toFixed(2)}%, USD/KRW ${snapshot.usdKrw.toFixed(2)}, 미국 원천징수세 ${(snapshot.taxRate * 100).toFixed(0)}%.`,
      '투자 권유가 아닌 정보 제공용 콘텐츠입니다.',
    ].join('\n'),
    tags: ['SCHD', '배당성장ETF', 'JEPQ', '미국ETF', '배당투자', '장기투자'],
    thumbnailText: ['SCHD 장기투자?', '월 100만 원 숫자', '함정까지 정리'],
    disclosure: '이 영상은 AI 음성과 자동 생성 그래픽을 포함하며 투자 권유가 아닙니다.',
    format: 'longform',
    scenes: longformScenes(snapshot),
  };
  writeFileSync(path.join(outDir, 'video-plan-longform.json'), JSON.stringify({ snapshot, plan }, null, 2));
  writeFileSync(path.join(outDir, 'video-plan.json'), JSON.stringify({ snapshot, plan }, null, 2));
  return plan;
}

export async function generateDocumentaryLongformVideoPlan(snapshot) {
  const plan = {
    ticker: snapshot.ticker,
    title: 'SCHD가 JEPQ보다 심심해 보이는데도 계속 언급되는 진짜 이유',
    description: [
      '월배당 ETF에 끌리는 이유와 SCHD를 장기 관점에서 비교해야 하는 이유를 삽화형 롱폼으로 정리합니다.',
      `계산 기준: SCHD 30일 SEC Yield ${(snapshot.annualYield * 100).toFixed(2)}%, USD/KRW ${snapshot.usdKrw.toFixed(2)}, 미국 원천징수세 ${(snapshot.taxRate * 100).toFixed(0)}%.`,
      '투자 권유가 아닌 정보 제공용 콘텐츠입니다.',
    ].join('\n'),
    tags: ['SCHD', 'JEPQ', '배당ETF', '배당성장', '미국ETF', '장기투자'],
    thumbnailText: ['JEPQ 말고', 'SCHD를 보는 진짜 이유', '월 100만 원의 현실'],
    disclosure: '이 영상은 AI 음성과 자동 생성 삽화를 포함하며 투자 권유가 아닙니다.',
    format: 'documentary',
    aspect: '16:9',
    scenes: documentaryScenes(snapshot),
  };
  writeFileSync(path.join(outDir, 'video-plan-documentary.json'), JSON.stringify({ snapshot, plan }, null, 2));
  writeFileSync(path.join(outDir, 'video-plan.json'), JSON.stringify({ snapshot, plan }, null, 2));
  return plan;
}

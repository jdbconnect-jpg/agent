import { copyFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { outDir } from './config.mjs';
import { renderVideo } from './media.mjs';
import { uploadVideo } from './upload.mjs';

const batchDir = path.join(outDir, 'batch-test-videos');

const topics = [
  {
    id: 'popular-etf-top5',
    ticker: 'ETF TOP 5',
    title: '요즘 인기 ETF TOP 5, 그냥 따라 사면 위험한 이유',
    thumb: ['ETF TOP 5', '요즘 돈 몰리는 곳', '따라 사면 위험?'],
    tags: ['ETF', '미국ETF', 'VOO', 'SPY', 'QQQ', 'IBIT', 'SGOV'],
    scenes: [
      ['요즘 ETF TOP 5', '인기만 보면 위험', '요즘 투자자들이 많이 찾는 ETF 다섯 개를 빠르게 보겠습니다. 하지만 이 영상은 매수 추천이 아닙니다. 인기 ETF가 내 계좌에 맞는 ETF라는 뜻은 아니기 때문입니다.', 'hook'],
      ['5위 SGOV', '현금 대기처', 'SGOV는 초단기 미국 국채 ETF입니다. 시장이 불안할 때 현금을 잠깐 세워두는 대기실처럼 보는 사람이 많습니다. 다만 금리가 내려가면 기대 수익률도 낮아질 수 있습니다.', 'number'],
      ['4위 IBIT', '비트코인 ETF', 'IBIT는 비트코인을 ETF처럼 거래하고 싶은 사람들의 관심을 받습니다. 접근성은 좋아졌지만, 본질은 여전히 비트코인 가격 변동입니다. 하루 변동폭이 클 수 있습니다.', 'conflict'],
      ['3위 QQQ', 'AI와 빅테크', 'QQQ는 AI와 빅테크 기대감을 한 번에 담는 대표 ETF입니다. 성장 기대감은 크지만 기술주 쏠림도 큽니다. 분위기가 바뀌면 낙폭이 커질 수 있습니다.', 'number'],
      ['2위 SPY', '가장 유명한 지수', 'SPY는 S&P 500 대표 ETF입니다. 거래량과 인지도가 크다는 장점이 있습니다. 하지만 장기 보유자는 운용보수와 대체 ETF도 비교해야 합니다.', 'close'],
      ['1위 VOO', '평범하지만 강함', 'VOO는 낮은 비용으로 미국 대형주에 넓게 투자하는 ETF입니다. 화려하진 않지만 꾸준히 언급됩니다. 그래도 미국 시장 전체가 흔들리면 VOO도 같이 흔들립니다.', 'risk'],
      ['결론', '순위보다 역할', 'ETF 순위는 시장의 관심을 읽는 출발점입니다. 진짜 선택은 내 목표가 성장인지, 안정인지, 현금 대기인지 정한 뒤에 해야 합니다.', 'close'],
    ],
  },
  {
    id: 'ai-etf-boom',
    ticker: 'AI ETF',
    title: 'AI ETF 지금 들어가도 될까? 사람들이 놓치는 진짜 리스크',
    thumb: ['AI ETF', '지금 사도 될까?', '숨은 리스크'],
    tags: ['AIETF', 'QQQ', '반도체ETF', '미국주식', '테마ETF'],
    scenes: [
      ['AI ETF 열풍', '돈이 몰리는 이유', '2026년 ETF 시장에서 AI와 반도체, 데이터센터 인프라는 여전히 강한 관심을 받고 있습니다. 문제는 관심이 높을수록 가격도 이미 반영됐을 수 있다는 점입니다.', 'hook'],
      ['핵심은 인프라', '소프트웨어만 아님', '요즘 AI 투자는 단순한 앱 이야기가 아닙니다. 반도체, 전력망, 데이터센터, 냉각 시스템까지 돈이 흐르는 길이 넓어졌습니다.', 'number'],
      ['ETF 장점', '한 번에 분산', '개별 AI 주식을 고르기 어렵다면 ETF는 여러 기업을 묶어 접근하는 방법이 됩니다. 하지만 분산됐다고 해서 손실 위험이 사라지는 것은 아닙니다.', 'close'],
      ['가장 큰 함정', '비슷한 종목 중복', 'AI ETF 여러 개를 샀는데 실제 보유 종목은 엔비디아와 빅테크로 겹칠 수 있습니다. ETF 이름은 달라도 계좌 안은 비슷해질 수 있습니다.', 'risk'],
      ['조정장 리스크', '기대가 꺾이면?', '성장주는 기대가 클수록 실망에도 민감합니다. 실적이 좋아도 시장 기대에 못 미치면 가격이 크게 흔들릴 수 있습니다.', 'conflict'],
      ['체크 포인트', '보유 종목 보기', 'AI ETF를 보기 전에는 수수료, 상위 보유 종목, 섹터 집중도, 거래량을 확인해야 합니다. 이름보다 안에 무엇이 들어 있는지가 중요합니다.', 'number'],
      ['결론', '테마보다 비중', 'AI가 좋아 보여도 계좌 전체를 한 테마에 몰아넣는 것은 위험합니다. 핵심은 맞히는 것이 아니라 버틸 수 있는 비중입니다.', 'close'],
    ],
  },
  {
    id: 'bitcoin-etf-risk',
    ticker: 'IBIT',
    title: '비트코인 ETF, 편해졌지만 더 안전해진 건 아닙니다',
    thumb: ['비트코인 ETF', '편하지만 위험?', 'IBIT의 함정'],
    tags: ['IBIT', '비트코인ETF', 'CryptoETF', 'ETF', '재테크'],
    scenes: [
      ['비트코인 ETF', '계좌에서 바로 거래', '비트코인 ETF는 접근성을 크게 바꿨습니다. 복잡한 지갑 없이 증권 계좌에서 거래할 수 있기 때문입니다. 하지만 편해졌다는 말이 안전해졌다는 뜻은 아닙니다.', 'hook'],
      ['인기 이유', '접근성의 승리', 'IBIT 같은 현물 ETF는 기관과 개인 모두에게 쉬운 통로가 됐습니다. 그래서 관심과 자금이 빠르게 몰릴 수 있습니다.', 'number'],
      ['본질은 그대로', '비트코인 가격', 'ETF 껍데기를 써도 안에 있는 위험은 비트코인입니다. 가격이 급등락하면 ETF 가격도 그대로 흔들립니다.', 'conflict'],
      ['수수료도 보기', '보관 비용 포함', '비트코인 ETF는 운용보수와 추적 구조도 봐야 합니다. 장기 보유라면 작은 비용 차이도 누적됩니다.', 'number'],
      ['심리 리스크', '오를 때 더 사고 싶다', '비트코인은 가격이 오를수록 더 안전해 보이는 착시가 생깁니다. 하지만 변동성이 큰 자산은 상승장보다 하락장에서 진짜 성격이 드러납니다.', 'risk'],
      ['어울리는 사람', '변동성 감당 가능', '비트코인 ETF는 큰 변동성을 감당할 수 있는 사람에게만 일부 비중으로 검토할 만합니다. 생활비나 단기 자금으로 접근하면 위험합니다.', 'close'],
      ['결론', '편리함과 안전은 다르다', '비트코인 ETF는 편리한 도구입니다. 하지만 수익을 보장하는 도구는 아닙니다. 편리함에 속지 말고 비중부터 정해야 합니다.', 'close'],
    ],
  },
  {
    id: 'covered-call-income',
    ticker: 'JEPI/JEPQ',
    title: '월배당 ETF가 월급처럼 보일 때 꼭 봐야 할 함정',
    thumb: ['월배당 ETF', '월급처럼 보인다?', '진짜 함정'],
    tags: ['월배당ETF', 'JEPI', 'JEPQ', '커버드콜', '배당투자'],
    scenes: [
      ['월배당의 유혹', '매달 돈이 들어온다', '월배당 ETF는 단어 자체가 강합니다. 매달 현금이 들어온다는 느낌은 투자자에게 큰 매력으로 다가옵니다.', 'hook'],
      ['높은 배당률', '왜 가능할까?', 'JEPI나 JEPQ 같은 커버드콜 ETF는 옵션 프리미엄을 활용합니다. 그래서 일반 배당 ETF보다 높은 현금흐름처럼 보일 수 있습니다.', 'number'],
      ['첫 번째 함정', '상승장을 다 못 먹을 수 있다', '커버드콜 구조는 시장이 크게 오를 때 상승 여력을 일부 제한할 수 있습니다. 배당은 받지만 주가 상승은 덜 따라갈 수 있습니다.', 'risk'],
      ['두 번째 함정', '배당은 고정이 아님', '월배당이라고 해서 매달 같은 금액이 보장되는 것은 아닙니다. 시장 변동성과 옵션 수익에 따라 분배금이 달라질 수 있습니다.', 'conflict'],
      ['세 번째 함정', '원금도 흔들림', '배당을 받아도 ETF 가격이 더 크게 빠지면 계좌 전체는 손실일 수 있습니다. 배당이 원금 손실을 자동으로 지워주지는 않습니다.', 'risk'],
      ['사용법', '목적을 분리', '커버드콜 ETF는 현금흐름 목적에는 맞을 수 있지만 장기 성장 목적에는 다르게 봐야 합니다. 내 목표가 월 현금인지 총수익인지 먼저 정해야 합니다.', 'close'],
      ['결론', '월급처럼 보일 뿐', '월배당 ETF는 유용할 수 있지만 예금도 월급도 아닙니다. 높은 분배율보다 구조와 리스크를 먼저 봐야 합니다.', 'close'],
    ],
  },
  {
    id: 'schd-vs-jepq',
    ticker: 'SCHD',
    title: 'SCHD와 JEPQ, 둘 중 뭐가 좋냐보다 먼저 물어야 할 것',
    thumb: ['SCHD vs JEPQ', '정답은 없다', '목적이 다르다'],
    tags: ['SCHD', 'JEPQ', '배당ETF', '미국ETF', '장기투자'],
    scenes: [
      ['SCHD vs JEPQ', '비교가 많은 이유', 'SCHD와 JEPQ는 둘 다 배당 ETF로 자주 비교됩니다. 하지만 사실 두 상품은 목적이 꽤 다릅니다.', 'hook'],
      ['JEPQ 성격', '높은 월 현금흐름', 'JEPQ는 나스닥 기반 커버드콜 전략으로 높은 분배금을 기대하는 사람이 많이 봅니다. 대신 상승장 참여와 분배금 변동을 함께 봐야 합니다.', 'number'],
      ['SCHD 성격', '배당 성장', 'SCHD는 높은 월배당보다 배당 성장과 기업 체력을 보는 ETF에 가깝습니다. 당장 현금흐름은 덜 자극적일 수 있습니다.', 'close'],
      ['가장 큰 차이', '현금흐름 vs 성장', 'JEPQ는 지금 받는 현금흐름이 더 눈에 띄고, SCHD는 긴 시간의 배당 성장 기대가 더 큽니다. 둘은 같은 문제의 답이 아닙니다.', 'conflict'],
      ['리스크', '둘 다 원금 변동', '어느 쪽이든 주식형 ETF입니다. 배당을 받는 동안 원금이 흔들릴 수 있고, 시장 하락에는 같이 영향을 받습니다.', 'risk'],
      ['선택 기준', '돈의 용도', '생활비 현금흐름이 필요하면 JEPQ를 비교하고, 장기 배당 성장 포트폴리오라면 SCHD를 비교하는 식으로 목적부터 정해야 합니다.', 'number'],
      ['결론', '좋은 ETF보다 맞는 ETF', '정답은 하나가 아닙니다. 좋은 ETF를 찾기보다 내 목적에 맞는 ETF를 고르는 것이 먼저입니다.', 'close'],
    ],
  },
  {
    id: 'nuclear-energy-etf',
    ticker: 'NUKZ/URA',
    title: 'AI 시대에 전기가 부족하다? 원전 ETF가 뜨는 이유',
    thumb: ['원전 ETF', 'AI 전력 수요', '진짜 기회?'],
    tags: ['원전ETF', '우라늄ETF', 'AI전력', '테마ETF', 'URA'],
    scenes: [
      ['AI의 숨은 연료', '전기가 필요하다', 'AI가 커질수록 데이터센터와 전력 수요 이야기도 같이 커집니다. 그래서 원전과 우라늄 ETF가 다시 주목받고 있습니다.', 'hook'],
      ['인기 이유', '전력 인프라', 'AI는 소프트웨어처럼 보이지만 실제로는 반도체와 전력, 냉각, 데이터센터가 필요합니다. 전력 공급이 병목이 될 수 있다는 기대가 테마를 키웁니다.', 'number'],
      ['원전 ETF', '테마는 강하다', '원전 ETF는 우라늄, 원전 기술, 관련 인프라 기업에 접근하는 방법입니다. 개별 종목보다 분산된다는 장점이 있습니다.', 'close'],
      ['첫 번째 리스크', '정책 의존도', '원전 산업은 정책, 규제, 허가에 크게 영향을 받습니다. 좋은 이야기만으로 바로 실적이 나오는 구조가 아닐 수 있습니다.', 'risk'],
      ['두 번째 리스크', '가격 변동', '우라늄과 관련주는 수급 뉴스에 따라 크게 움직일 수 있습니다. 테마가 뜨면 가격도 이미 앞서갈 수 있습니다.', 'conflict'],
      ['체크 포인트', '보유 종목 확인', '원전 ETF라고 해도 안에 우라늄 채굴주가 많은지, 전력 인프라가 많은지, 원전 운영사가 많은지 확인해야 합니다.', 'number'],
      ['결론', '스토리는 좋지만 비중은 작게', 'AI 전력 수요라는 이야기는 매력적입니다. 하지만 테마 ETF는 변동성이 크기 때문에 작은 비중으로 보는 것이 현실적입니다.', 'close'],
    ],
  },
  {
    id: 'defense-etf',
    ticker: 'ITA/XAR',
    title: '방산 ETF가 조용히 강한 이유와 늦게 들어갈 때의 위험',
    thumb: ['방산 ETF', '조용히 강하다?', '늦으면 위험'],
    tags: ['방산ETF', 'ITA', 'XAR', '지정학', '테마ETF'],
    scenes: [
      ['방산 ETF', '왜 관심이 커질까?', '지정학 갈등이 길어지고 각국 국방비가 늘어나면 방산 ETF가 주목받습니다. 뉴스 흐름과 투자 관심이 직접 연결되는 테마입니다.', 'hook'],
      ['인기 이유', '정부 지출', '방산 기업은 정부 계약과 장기 예산의 영향을 받습니다. 그래서 경기와 별개로 꾸준한 수요를 기대하는 투자자가 있습니다.', 'number'],
      ['ETF 장점', '개별 계약 리스크 분산', '방산 ETF는 한 기업의 계약 실패보다 산업 전체에 분산할 수 있다는 장점이 있습니다. 하지만 분산이 모든 리스크를 없애지는 않습니다.', 'close'],
      ['함정 1', '뉴스에 늦게 반응', '전쟁과 갈등 뉴스가 이미 가격에 반영된 뒤 들어가면 기대보다 수익이 낮을 수 있습니다. 테마는 유명해질수록 비싸질 수 있습니다.', 'risk'],
      ['함정 2', '윤리와 변동성', '방산 투자는 투자자마다 불편함을 느낄 수 있는 영역입니다. 또한 예산 삭감이나 정치 변화에 따라 가격이 흔들릴 수 있습니다.', 'conflict'],
      ['체크 포인트', '상위 종목 쏠림', 'ITA와 XAR처럼 방산 ETF도 보유 종목과 가중 방식이 다릅니다. 대형주 집중인지 균등에 가까운지 확인해야 합니다.', 'number'],
      ['결론', '강한 테마일수록 차갑게', '방산 ETF는 구조적 관심을 받을 수 있지만 늦게 쫓아가면 위험합니다. 뉴스보다 가격과 비중을 먼저 봐야 합니다.', 'close'],
    ],
  },
  {
    id: 'semiconductor-etf',
    ticker: 'SOXX/SMH',
    title: '반도체 ETF, AI 수혜주처럼 보이지만 가장 크게 흔들릴 수 있습니다',
    thumb: ['반도체 ETF', 'AI 수혜?', '변동성 주의'],
    tags: ['반도체ETF', 'SOXX', 'SMH', 'AI', '엔비디아'],
    scenes: [
      ['반도체 ETF', 'AI의 심장?', 'AI 투자를 이야기하면 반도체를 빼기 어렵습니다. 그래서 SOXX나 SMH 같은 반도체 ETF가 자주 언급됩니다.', 'hook'],
      ['인기 이유', 'AI 인프라', 'AI 모델이 커질수록 칩과 장비, 메모리 수요가 중요해집니다. 반도체 ETF는 그 흐름에 한 번에 접근하는 방법입니다.', 'number'],
      ['장점', '개별 종목보다 넓게', '엔비디아 하나를 고르기 어렵다면 ETF로 산업 전체에 분산할 수 있습니다. 하지만 상위 종목 비중은 꼭 확인해야 합니다.', 'close'],
      ['함정 1', '이미 너무 올랐나?', '좋은 산업이어도 가격이 너무 앞서가면 수익률은 실망스러울 수 있습니다. 훌륭한 회사와 훌륭한 진입 가격은 다릅니다.', 'risk'],
      ['함정 2', '사이클 산업', '반도체는 장기 성장 산업이지만 경기와 재고 사이클에 민감합니다. 수요 둔화 뉴스에 크게 흔들릴 수 있습니다.', 'conflict'],
      ['체크 포인트', '엔비디아 비중', '반도체 ETF를 여러 개 사도 상위 보유 종목이 겹칠 수 있습니다. 결국 계좌가 한두 종목에 과하게 의존할 수 있습니다.', 'number'],
      ['결론', '핵심은 분할과 비중', '반도체 ETF는 매력적인 테마지만 변동성도 큽니다. 한 번에 몰아넣기보다 비중과 분할이 중요합니다.', 'close'],
    ],
  },
  {
    id: 'short-term-bond-etf',
    ticker: 'SGOV/BIL',
    title: '예금 대신 초단기채 ETF? 사람들이 SGOV를 보는 이유',
    thumb: ['초단기채 ETF', '예금 대체?', 'SGOV 체크'],
    tags: ['SGOV', 'BIL', '채권ETF', '초단기채', '현금관리'],
    scenes: [
      ['초단기채 ETF', '현금 관리 도구', '요즘 불확실한 시장에서 초단기채 ETF를 현금 대기처처럼 보는 사람이 많습니다. SGOV와 BIL 같은 상품이 대표적입니다.', 'hook'],
      ['왜 인기?', '짧은 만기', '초단기 미국 국채 ETF는 만기가 짧아 금리 변동에 상대적으로 덜 민감합니다. 그래서 대기 자금 관리 도구로 자주 언급됩니다.', 'number'],
      ['예금과 차이', '원금 보장 아님', '하지만 ETF는 예금이 아닙니다. 가격 변동이 작아도 존재하고, 환율과 세금도 고려해야 합니다.', 'conflict'],
      ['수익률', '금리에 따라 변함', '현재 수익률이 좋아 보여도 금리가 내려가면 기대 수익률은 낮아질 수 있습니다. 과거 수익률을 고정 수익처럼 보면 안 됩니다.', 'risk'],
      ['장점', '유동성과 편의성', '증권 계좌 안에서 사고팔 수 있고, 주식 투자 대기 자금을 관리하기 편하다는 장점이 있습니다.', 'close'],
      ['체크 포인트', '환율과 세금', '미국 ETF로 접근하면 달러 환율이 결과에 영향을 줄 수 있습니다. 세후 수익률도 같이 계산해야 합니다.', 'number'],
      ['결론', '현금 대기실로 보기', '초단기채 ETF는 공격적인 수익보다 현금 관리에 가까운 도구입니다. 예금 대체가 아니라 계좌 안 대기실로 보는 편이 안전합니다.', 'close'],
    ],
  },
  {
    id: 'dividend-growth-etf',
    ticker: 'SCHD/DGRO',
    title: '배당성장 ETF, 배당률보다 더 중요한 숫자는 따로 있습니다',
    thumb: ['배당성장 ETF', '배당률 말고', '이 숫자 보세요'],
    tags: ['배당성장ETF', 'SCHD', 'DGRO', 'VIG', '배당투자'],
    scenes: [
      ['배당성장 ETF', '낮아 보여도 보는 이유', '배당성장 ETF는 배당률만 보면 심심해 보일 수 있습니다. 하지만 사람들이 보는 포인트는 오늘의 배당률이 아니라 앞으로의 배당 체력입니다.', 'hook'],
      ['핵심 숫자', '배당 성장률', '배당성장 ETF를 볼 때는 현재 배당률과 함께 배당 성장률을 봐야 합니다. 매년 배당을 늘릴 수 있는 기업인지가 중요합니다.', 'number'],
      ['두 번째 숫자', '총수익률', '배당을 많이 받아도 주가가 계속 빠지면 좋은 투자가 아닐 수 있습니다. 배당과 가격 변화를 합친 총수익률을 봐야 합니다.', 'conflict'],
      ['세 번째 숫자', '구성 종목', 'SCHD, DGRO, VIG는 모두 배당 ETF지만 담는 기업과 기준이 다릅니다. 이름보다 편입 기준을 확인해야 합니다.', 'number'],
      ['함정', '배당도 줄 수 있다', '배당 성장이라는 이름이 앞으로도 계속 오른다는 보장은 아닙니다. 경기와 기업 실적에 따라 배당은 줄거나 정체될 수 있습니다.', 'risk'],
      ['사용법', '장기 포트폴리오', '배당성장 ETF는 단기 월급보다 장기 복리와 재투자에 더 잘 맞습니다. 생활비용인지 장기 자산용인지 목적을 구분해야 합니다.', 'close'],
      ['결론', '배당률만 보지 말기', '배당성장 ETF는 배당률 하나로 판단하면 놓치는 게 많습니다. 성장률, 총수익률, 구성 종목을 같이 봐야 합니다.', 'close'],
    ],
  },
  {
    id: 'leveraged-etf-warning',
    ticker: 'TQQQ',
    title: '레버리지 ETF로 빨리 부자 되려다 계좌가 녹는 이유',
    thumb: ['레버리지 ETF', '빨리 부자?', '계좌가 녹는 이유'],
    tags: ['TQQQ', '레버리지ETF', 'SOXL', '위험관리', 'ETF'],
    scenes: [
      ['레버리지 ETF', '수익도 손실도 빠르다', 'TQQQ나 SOXL 같은 레버리지 ETF는 상승장에서 강하게 보입니다. 하지만 빨리 오르는 만큼 빨리 무너질 수 있습니다.', 'hook'],
      ['왜 위험?', '매일 수익률을 추종', '레버리지 ETF는 장기 수익률을 단순히 세 배로 만들어주는 구조가 아닙니다. 매일 수익률을 기준으로 움직이기 때문에 경로가 중요합니다.', 'number'],
      ['변동성 끌림', '오르내리면 손해', '시장이 오르락내리락하면 원래 지수는 제자리여도 레버리지 ETF는 손실이 쌓일 수 있습니다. 이것을 변동성 손실이라고 부릅니다.', 'risk'],
      ['심리 함정', '하락 때 물타기', '가격이 크게 빠지면 싸 보이지만 레버리지는 더 빠르게 계좌를 압박합니다. 물타기가 회복이 아니라 위험 확대가 될 수 있습니다.', 'conflict'],
      ['사용 목적', '장기 보유용 아님', '레버리지 ETF는 보통 단기 전술용에 가깝습니다. 장기 보유한다면 구조와 손실 가능성을 매우 보수적으로 봐야 합니다.', 'number'],
      ['체크 포인트', '최악의 하락폭', '투자 전에는 기대 수익보다 먼저 최대 손실을 상상해야 합니다. 절반 이상 빠져도 버틸 수 있는지 냉정하게 봐야 합니다.', 'risk'],
      ['결론', '빠른 길은 흔들린다', '레버리지 ETF는 도구일 뿐 지름길이 아닙니다. 잘 모르면 작은 금액으로만 실험하거나 피하는 것이 낫습니다.', 'close'],
    ],
  },
];

function scene(title, subtitle, narration, visual, durationSec = 8) {
  return { title, subtitle, narration, visual, durationSec };
}

function makePlan(topic) {
  return {
    ticker: topic.ticker,
    title: topic.title,
    description: [
      `${topic.title}를 짧은 테스트 영상으로 정리했습니다.`,
      '최근 ETF 시장에서 관심을 받는 주제지만, 특정 상품 매수나 수익을 보장하는 내용은 아닙니다.',
      '투자 전에는 수수료, 구성 종목, 세금, 환율, 변동성을 직접 확인해야 합니다.',
    ].join('\n'),
    tags: [...topic.tags, '투자권유아님', '재테크', 'ETF투자'],
    thumbnailText: topic.thumb,
    disclosure: '이 영상은 정보 제공용이며 투자 권유가 아닙니다. 모든 투자의 책임은 투자자 본인에게 있습니다.',
    format: 'batch-test',
    scenes: topic.scenes.map(([title, subtitle, narration, visual]) => scene(title, subtitle, narration, visual)),
  };
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9가-힣-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

async function main() {
  mkdirSync(batchDir, { recursive: true });
  const results = [];
  const stockManifest = path.join(outDir, 'stock', 'manifest.json');
  const disabledStockManifest = path.join(outDir, 'stock', 'manifest.batch-disabled.json');

  if (existsSync(stockManifest)) {
    if (existsSync(disabledStockManifest)) renameSync(disabledStockManifest, `${disabledStockManifest}.${Date.now()}`);
    renameSync(stockManifest, disabledStockManifest);
  }

  try {
    for (const [index, topic] of topics.slice(0, 10).entries()) {
      const number = String(index + 1).padStart(2, '0');
      const plan = makePlan(topic);
      const planPath = path.join(outDir, 'video-plan.json');
      writeFileSync(planPath, JSON.stringify({ plan }, null, 2));
      writeFileSync(path.join(batchDir, `${number}-${topic.id}-plan.json`), JSON.stringify({ plan }, null, 2));

      console.log(`\n[${number}/10] Rendering: ${plan.title}`);
      const renderResult = await renderVideo(plan);
      const videoPath = path.join(batchDir, `${number}-${safeName(topic.id)}.mp4`);
      const thumbnailPath = path.join(batchDir, `${number}-${safeName(topic.id)}.jpg`);
      copyFileSync(renderResult.videoPath, videoPath);
      copyFileSync(path.join(outDir, 'thumbnail.jpg'), thumbnailPath);

      const item = { index: index + 1, id: topic.id, title: plan.title, videoPath, thumbnailPath, uploaded: false };

      try {
        console.log(`[${number}/10] Uploading private test video...`);
        const uploaded = await uploadVideo({ videoPath });
        item.uploaded = true;
        item.youtubeId = uploaded.id;
        item.youtubeUrl = `https://www.youtube.com/watch?v=${uploaded.id}`;
        console.log(`[${number}/10] Uploaded: ${item.youtubeUrl}`);
      } catch (error) {
        item.error = error.message;
        console.log(`[${number}/10] Upload failed: ${error.message}`);
      }

      results.push(item);
      writeFileSync(path.join(batchDir, 'results.json'), JSON.stringify(results, null, 2));
    }
  } finally {
    if (existsSync(disabledStockManifest) && !existsSync(stockManifest)) renameSync(disabledStockManifest, stockManifest);
  }

  console.log(`\nBatch complete. Results: ${path.join(batchDir, 'results.json')}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

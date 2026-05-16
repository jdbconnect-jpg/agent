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

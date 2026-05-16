import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const rootDir = path.resolve(import.meta.dirname, '..');
export const outDir = path.join(rootDir, 'out');
export const framesDir = path.join(outDir, 'frames');
export const tokenPath = path.join(rootDir, 'youtube-oauth-token.json');

mkdirSync(outDir, { recursive: true });
mkdirSync(framesDir, { recursive: true });

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5.1',
  ttsModel: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
  ttsVoice: process.env.OPENAI_TTS_VOICE || 'onyx',
  ttsProvider: process.env.TTS_PROVIDER || 'openai',
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
  },
  pexels: {
    apiKey: process.env.PEXELS_API_KEY || '',
    query: process.env.PEXELS_QUERY || 'stock market, finance, money',
    clips: Number(process.env.PEXELS_CLIPS || 4),
  },
  coverr: {
    apiKey: process.env.COVERR_API_KEY || '',
    query: process.env.COVERR_QUERY || 'finance',
    clips: Number(process.env.COVERR_CLIPS || 4),
  },
  pixabay: {
    apiKey: process.env.PIXABAY_API_KEY || '',
    query: process.env.PIXABAY_QUERY || 'stock market finance',
    clips: Number(process.env.PIXABAY_CLIPS || 4),
  },
  shotstack: {
    apiKey: process.env.SHOTSTACK_API_KEY || '',
    env: process.env.SHOTSTACK_ENV || 'stage',
  },
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  targetMonthlyKrw: Number(process.env.TARGET_MONTHLY_KRW || 1_000_000),
  etfTicker: process.env.ETF_TICKER || 'SCHD',
  etfAnnualYield: Number(process.env.ETF_ANNUAL_YIELD || 0.0331),
  jepqAnnualYield: Number(process.env.JEPQ_ANNUAL_YIELD || 0.1031),
  jepqMonthlyDividendUsd: Number(process.env.JEPQ_MONTHLY_DIVIDEND_USD || 0.591),
  usWithholdingTaxRate: Number(process.env.US_WITHHOLDING_TAX_RATE || 0.15),
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:53682/oauth2callback',
    privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS || 'private',
    categoryId: process.env.YOUTUBE_CATEGORY_ID || '25',
  },
};

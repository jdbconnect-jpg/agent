import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { framesDir, outDir } from './config.mjs';
import { synthesizeNarration, writeCaptions } from './media.mjs';

const W = 1280;
const H = 720;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrap(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function palette(visual) {
  return {
    temptation: ['#d8c7a4', '#31412a', '#ffe200'],
    yield: ['#d6d2c6', '#233340', '#ffdf2e'],
    compare: ['#cfc7b7', '#1f3850', '#ffffff'],
    calculation: ['#d8c7a4', '#422b20', '#33e37b'],
    calendar: ['#d6d2c6', '#28323d', '#ffe200'],
    risk: ['#c8beb1', '#3f2426', '#ff465d'],
    close: ['#d8d0bd', '#253d33', '#7cffb2'],
  }[visual] || ['#d8c7a4', '#26343d', '#ffe200'];
}

function paperTexture() {
  return `
    <filter id="paper">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 .12"/>
      </feComponentTransfer>
    </filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="8" dy="9" stdDeviation="0" flood-color="#000" flood-opacity=".92"/>
    </filter>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000" flood-opacity=".35"/>
    </filter>`;
}

function titleBlock(scene, accent) {
  const titleLines = wrap(scene.title, 13);
  const subtitleLines = wrap(scene.subtitle, 20);
  const titleSize = titleLines.length > 1 ? 70 : 86;
  const subtitleSize = subtitleLines.length > 1 ? 42 : 48;
  return `
    <g transform="translate(38,392)">
      <rect x="0" y="0" width="1168" height="264" rx="10" fill="#050505" opacity=".72"/>
      ${titleLines.map((line, i) =>
        `<text x="34" y="${78 + i * 78}" class="headline" font-size="${titleSize}" fill="${accent}">${escapeXml(line)}</text>`
      ).join('')}
      ${subtitleLines.map((line, i) =>
        `<text x="38" y="${190 + i * 50}" class="subhead" font-size="${subtitleSize}" fill="#fff">${escapeXml(line)}</text>`
      ).join('')}
    </g>`;
}

function person(x, y, clothes = '#6aa98b', face = '#f0c7a6') {
  return `
    <g transform="translate(${x},${y})" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M95 190 C60 150,58 96,92 68 C128 38,184 48,206 90 C230 138,206 178,172 194 Z" fill="${face}"/>
      <path d="M78 78 C92 26,178 25,208 82 C172 65,124 66,78 78 Z" fill="#2f2b26"/>
      <circle cx="112" cy="120" r="5" fill="#111"/><circle cx="168" cy="120" r="5" fill="#111"/>
      <path d="M122 155 Q142 168 164 154" fill="none"/>
      <path d="M50 330 C70 222,104 202,146 206 C194 208,228 232,246 330 Z" fill="${clothes}"/>
      <path d="M88 236 L145 304 L204 232" fill="none"/>
      <path d="M70 266 C30 285,30 330,70 344" fill="none"/>
      <path d="M225 266 C272 290,268 334,226 346" fill="none"/>
    </g>`;
}

function chart(x, y, scale = 1) {
  const bars = [60, 96, 74, 132, 112, 160, 142];
  return `
    <g transform="translate(${x},${y}) scale(${scale})" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="0" y="0" width="360" height="220" rx="14" fill="#edf0de"/>
      <path d="M34 176 H322 M34 30 V176" fill="none"/>
      ${bars.map((h, i) => `<rect x="${58 + i * 36}" y="${176 - h}" width="20" height="${h}" fill="${i % 2 ? '#ff526d' : '#2edc78'}"/>`).join('')}
      <path d="M52 160 C98 130,132 150,174 100 S258 78,318 48" fill="none" stroke="#2bdc77" stroke-width="9"/>
    </g>`;
}

function calendarIcon(x, y) {
  return `
    <g transform="translate(${x},${y})" stroke="#111" stroke-width="5" stroke-linejoin="round">
      <rect x="0" y="0" width="300" height="230" rx="18" fill="#f0efe3"/>
      <rect x="0" y="0" width="300" height="62" rx="18" fill="#ffdf2e"/>
      ${[0, 1, 2, 3].map((row) => [0, 1, 2, 3].map((col) =>
        `<rect x="${38 + col * 58}" y="${88 + row * 32}" width="32" height="20" rx="4" fill="${row === 1 && col === 2 ? '#ff526d' : '#c7c7bd'}"/>`
      ).join('')).join('')}
      <text x="150" y="50" text-anchor="middle" class="label" fill="#111">분기</text>
    </g>`;
}

function scales(x, y) {
  return `
    <g transform="translate(${x},${y})" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M160 20 V220 M90 220 H230 M60 72 H260" fill="none"/>
      <path d="M70 72 L30 158 H112 Z" fill="#ff526d"/>
      <path d="M250 72 L202 148 H298 Z" fill="#2edc78"/>
      <circle cx="160" cy="72" r="10" fill="#111"/>
      <text x="70" y="190" text-anchor="middle" class="tiny">고배당</text>
      <text x="250" y="180" text-anchor="middle" class="tiny">성장</text>
    </g>`;
}

function visualArt(scene, bg, accent) {
  if (scene.visual === 'temptation') {
    return `${person(780, 95, '#88b79d')}${chart(435, 118, .85)}
      <path d="M160 118 C220 72,310 86,360 148 C294 128,222 132,160 118 Z" fill="#5e713d" stroke="#111" stroke-width="5"/>
      <text x="108" y="220" class="brush" fill="#434b3b">월배당</text>`;
  }
  if (scene.visual === 'yield') {
    return `${person(838, 105, '#5d81a2')}${chart(98, 116, 1.04)}
      <text x="504" y="126" class="bigNum" fill="${accent}">3.31%</text>
      <text x="510" y="190" class="label" fill="#111">낮아 보이는 숫자</text>`;
  }
  if (scene.visual === 'compare') {
    return `${scales(470, 100)}${person(160, 130, '#b7886a')}${person(850, 130, '#5c7baa')}
      <text x="178" y="100" class="label" fill="#111">JEPQ</text>
      <text x="866" y="100" class="label" fill="#111">SCHD</text>`;
  }
  if (scene.visual === 'calculation') {
    return `${chart(780, 126, .84)}
      <rect x="94" y="92" width="560" height="230" rx="22" fill="#f3efe2" stroke="#111" stroke-width="6"/>
      <text x="374" y="178" text-anchor="middle" class="label" fill="#111">필요 원금</text>
      <text x="374" y="272" text-anchor="middle" class="bigNum" fill="${accent}">4.27억</text>`;
  }
  if (scene.visual === 'calendar') {
    return `${calendarIcon(112, 104)}${person(810, 112, '#738090')}
      <path d="M478 192 H732" stroke="#111" stroke-width="8" stroke-linecap="round"/>
      <path d="M696 154 L744 192 L696 230" fill="none" stroke="#111" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (scene.visual === 'risk') {
    return `${person(820, 104, '#8d6970')}${chart(110, 104, 1)}
      <path d="M126 120 C210 176,292 120,374 204 S520 290,620 238" fill="none" stroke="#ff405d" stroke-width="15"/>
      <text x="520" y="160" class="label" fill="#663238">원금 변동</text>`;
  }
  return `${person(802, 105, '#6aa98b')}${chart(105, 116, 1)}
    <path d="M496 288 C580 222,650 178,735 96" fill="none" stroke="#2edc78" stroke-width="20" stroke-linecap="round"/>
    <path d="M682 92 L746 84 L726 146" fill="none" stroke="#2edc78" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function renderSceneSvg(scene, index, total, ticker) {
  const [paper, bg, accent] = palette(scene.visual);
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>${paperTexture()}</defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .headline { filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 6px; }
      .subhead { filter: url(#shadow); paint-order: stroke; stroke: #000; stroke-width: 5px; }
      .label { font-size: 34px; font-weight: 900; }
      .tiny { font-size: 22px; font-weight: 900; }
      .bigNum { font-size: 82px; font-weight: 900; paint-order: stroke; stroke: #111; stroke-width: 4px; }
      .brush { font-size: 72px; font-weight: 900; opacity: .9; transform: rotate(-8deg); paint-order: stroke; stroke: #111; stroke-width: 3px; }
    </style>
    <rect width="${W}" height="${H}" fill="${paper}"/>
    <rect width="${W}" height="${H}" fill="#000" opacity=".06" filter="url(#paper)"/>
    <path d="M0 0 H1280 V720 H0 Z" fill="none" stroke="#111" stroke-width="28"/>
    <rect x="28" y="28" width="1224" height="664" fill="${bg}" opacity=".12"/>
    <g transform="translate(30,28)">
      <rect width="126" height="54" rx="4" fill="#111"/>
      <text x="63" y="38" text-anchor="middle" fill="#fff" font-size="28">${escapeXml(ticker)}</text>
    </g>
    <g transform="translate(1080,36)">
      <rect width="132" height="42" rx="4" fill="#111" opacity=".88"/>
      <text x="66" y="30" text-anchor="middle" fill="#fff" font-size="24">${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</text>
    </g>
    ${visualArt(scene, bg, accent)}
    ${titleBlock(scene, accent)}
  </svg>`;
}

function renderThumbnailSvg(plan) {
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>${paperTexture()}</defs>
    <style>
      text { font-family: "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif; font-weight: 900; letter-spacing: 0; }
      .big { font-size: 78px; paint-order: stroke; stroke: #000; stroke-width: 7px; filter: url(#shadow); }
      .sub { font-size: 58px; paint-order: stroke; stroke: #000; stroke-width: 6px; filter: url(#shadow); }
    </style>
    <rect width="${W}" height="${H}" fill="#d8c7a4"/>
    <rect width="${W}" height="${H}" fill="#000" opacity=".08" filter="url(#paper)"/>
    <path d="M0 0 H1280 V720 H0 Z" fill="none" stroke="#111" stroke-width="28"/>
    ${person(842, 84, '#5d81a2')}
    ${person(634, 90, '#88b79d')}
    ${chart(64, 106, .9)}
    <text x="82" y="84" fill="#fff" font-size="30" paint-order="stroke" stroke="#111" stroke-width="5">${escapeXml(plan.ticker || 'SCHD')}</text>
    <rect x="34" y="390" width="1208" height="262" rx="8" fill="#050505" opacity=".78"/>
    <text x="62" y="488" class="big" fill="#ffe200">${escapeXml(plan.thumbnailText[1] || 'SCHD를 보는 진짜 이유')}</text>
    <text x="62" y="582" class="sub" fill="#fff">${escapeXml(plan.thumbnailText[2] || '월 100만 원의 현실')}</text>
  </svg>`;
}

export async function renderDocumentaryVideo(plan) {
  const captionsPath = writeCaptions(plan);
  mkdirSync(framesDir, { recursive: true });
  const framePaths = [];
  for (const [index, scene] of plan.scenes.entries()) {
    const svg = renderSceneSvg(scene, index, plan.scenes.length, plan.ticker || 'SCHD');
    const framePath = path.join(framesDir, `documentary-${String(index).padStart(2, '0')}.png`);
    await sharp(Buffer.from(svg)).png().toFile(framePath);
    framePaths.push(framePath);
  }

  const thumbnailPath = path.join(outDir, 'thumbnail-documentary.jpg');
  await sharp(Buffer.from(renderThumbnailSvg(plan))).jpeg({ quality: 92 }).toFile(thumbnailPath);

  const { audioPath } = await synthesizeNarration(plan);
  const concatPath = path.join(outDir, 'documentary-scenes.ffconcat');
  const lines = ['ffconcat version 1.0'];
  plan.scenes.forEach((scene, index) => {
    lines.push(`file '${framePaths[index].replaceAll("'", "'\\''")}'`);
    lines.push(`duration ${Math.max(3, Number(scene.durationSec || 8))}`);
  });
  lines.push(`file '${framePaths.at(-1).replaceAll("'", "'\\''")}'`);
  writeFileSync(concatPath, lines.join('\n'));

  const videoPath = path.join(outDir, 'schd-documentary-longform.mp4');
  const audioDuration = Number(execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ], { encoding: 'utf8' }).trim());
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-i', audioPath,
    '-i', captionsPath,
    '-t', String(audioDuration),
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
    '-r', '30',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-map', '2:s:0',
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-crf', '18',
    '-preset', 'medium',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-c:s', 'mov_text',
    '-metadata:s:s:0', 'language=kor',
    '-shortest',
    videoPath,
  ], { stdio: 'inherit' });

  if (!existsSync(videoPath)) throw new Error('Documentary video render failed.');
  return { videoPath, thumbnailPath, audioPath };
}

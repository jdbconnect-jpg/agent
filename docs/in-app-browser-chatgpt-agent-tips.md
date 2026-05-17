# Codex In-App Browser ChatGPT Agent Tips

이 문서는 Codex 안의 in-app browser에서 ChatGPT를 열고, 영상용 스크립트와 씬 이미지를 가져오는 에이전트를 만들 때의 실전 팁을 정리한 것이다.

## 기본 정책

다음 작업부터 ChatGPT, Gemini, YouTube Studio처럼 사용자가 화면에서 로그인 상태를 확인하거나 결과물을 직접 봐야 하는 브라우저 작업은 Codex in-app browser를 기본으로 사용한다.

외부 Chrome/CDP 자동화는 아래 경우에만 보조 수단으로 사용한다.

- Codex in-app browser에서 파일 다운로드나 page asset 추출이 막힌 경우
- 장시간 반복 입력처럼 사용자가 명시적으로 외부 Chrome 자동화를 허용한 경우
- 이미 로그인된 in-app browser 세션이 없고, 작업을 중단하지 않기 위해 임시 우회가 필요한 경우

브라우저 자동화 우선순위:

1. Codex in-app browser에서 현재 탭 또는 새 탭을 열어 진행한다.
2. 사용자가 보고 있는 로그인 세션과 같은 화면에서 프롬프트 입력, 결과 확인, 이미지 저장을 처리한다.
3. 이미지/영상 후처리, 리사이즈, 렌더링, FFmpeg 작업은 로컬 Node 스크립트에서 처리한다.
4. 외부 Chrome/CDP를 썼다면 최종 보고에 그 이유를 짧게 남긴다.

## 핵심 흐름

1. Codex in-app browser에서 ChatGPT 탭을 연다.
2. 스크립트 생성 프롬프트를 보내고 JSON 응답을 받는다.
3. JSON을 `out/browser-longform-plan.json` 같은 제작 플랜 파일로 저장한다.
4. 각 씬의 `imagePrompt`를 다시 ChatGPT에 보내 이미지 생성 도구를 실행한다.
5. 브라우저의 page asset inventory에서 생성 이미지를 찾아 로컬 씬 이미지로 저장한다.
6. 저장된 이미지와 플랜을 렌더러에 넘겨 영상을 만든다.

## 왜 in-app browser를 쓰는가

외부 Chrome CDP 자동화도 가능하지만, 로그인이나 Cloudflare 대기 화면에서 자주 멈출 수 있다. Codex in-app browser는 사용자가 실제로 보고 있는 ChatGPT 세션과 같은 화면에서 진행되므로, 로그인 상태 확인과 수동 개입이 훨씬 쉽다.

## 브라우저 연결 팁

Codex Browser 플러그인의 `iab` 브라우저를 사용한다. 세션 이름을 붙여두면 여러 브라우저 작업이 섞일 때 추적하기 좋다.

```js
const { setupBrowserRuntime } = await import('/absolute/path/to/browser-client.mjs');
await setupBrowserRuntime({ globals: globalThis });
globalThis.browser = await agent.browsers.get('iab');
await browser.nameSession('🎬 ChatGPT video assets');
globalThis.tab = await browser.tabs.selected() || await browser.tabs.new();
await (await browser.capabilities.get('visibility')).set(true);
await tab.goto('https://chatgpt.com/');
```

## 스크립트 프롬프트 작성 팁

ChatGPT에 영상 대본을 맡길 때는 자유 문장보다 JSON 스키마를 강하게 고정하는 편이 안정적이다.

좋은 스키마:

```json
{
  "ticker": "KR-ETF-BEGINNER-TOP5",
  "slug": "korea-etf-beginner-top5",
  "title": "국장에서 처음 보면 좋은 ETF TOP 5",
  "description": "...",
  "tags": ["ETF", "국내ETF"],
  "thumbnailText": ["...", "...", "..."],
  "disclosure": "...",
  "format": "browser-longform",
  "aspect": "16:9",
  "character": {
    "name": "팬더 선생",
    "consistencyPrompt": "same cute panda teacher character..."
  },
  "research": {},
  "scenes": [
    {
      "title": "...",
      "subtitle": "...",
      "narration": "...",
      "durationSec": 30,
      "visual": "...",
      "imagePrompt": "..."
    }
  ]
}
```

프롬프트에는 반드시 아래 조건을 넣는다.

- JSON 객체 하나만 출력
- 마크다운, 설명, 코드블록 금지
- 투자 권유, 수익 보장 표현 금지
- 씬 수와 각 씬 길이 지정
- `imagePrompt`에 자막 안전 영역 지정
- 이미지 안에는 읽을 수 있는 글자, 숫자, 로고, 티커 금지

## 이미지 프롬프트 팁

일관된 캐릭터가 필요하면 모든 씬 프롬프트에 캐릭터 묘사를 반복해야 한다. “same character”만 쓰면 씬마다 얼굴이나 옷이 달라질 수 있다.

예시:

```text
same cute panda teacher character in every scene,
small round panda, black round glasses, mint green bow tie,
beige cardigan, tiny wooden pointer, warm friendly expression,
soft 3D animated documentary style.
```

자막과 타이틀을 영상 렌더러에서 얹을 예정이면 이미지 자체는 단순해야 한다.

```text
Leave the lower 36 percent of the frame dark, simple, clean,
and uncluttered for Korean subtitles.
No readable text, no numbers, no ETF names, no tickers,
no logos, no watermark, no UI screens, no complex charts.
```

## 생성 이미지 저장 팁

ChatGPT 이미지가 화면에 나타나면 `pageAssets` capability로 현재 페이지의 이미지 asset을 가져와 저장한다. 이미지 URL을 직접 추측해서 열지 말고, page asset inventory를 사용하는 편이 안정적이다.

개념 흐름:

```js
const pageAssets = await tab.capabilities.get('pageAssets');
const before = await pageAssets.list();
const beforeUrls = new Set(before.assets.filter((a) => a.kind === 'image').map((a) => a.url));

// ChatGPT에 이미지 프롬프트 전송

const after = await pageAssets.list();
const newImages = after.assets.filter((a) => a.kind === 'image' && !beforeUrls.has(a.url));
const image = newImages.at(-1);
const bundle = await pageAssets.bundle({ inventoryId: after.id, assetIds: [image.id] });
```

## 긴 JSON은 나눠서 받기

긴 JSON을 한 번에 다시 붙여넣으면 ChatGPT가 “대용량 붙여넣기”로 판단해서 첨부 파일처럼 처리할 수 있다. 이 경우 자동 추출이 어려워진다.

추천 방식:

- 1차: 전체 플랜 JSON 생성
- 2차: 씬 1~3 대사 확장
- 3차: 씬 4~6 대사 확장
- 4차: 씬 7~10 대사 확장
- 마지막: 로컬에서 JSON 병합

이렇게 나누면 4분대 롱폼 대본을 더 안정적으로 얻을 수 있다.

## in-app browser 런타임 주의점

in-app browser의 Node 런타임에서는 프로젝트의 네이티브 모듈이 그대로 로드되지 않을 수 있다. 예를 들어 `sharp`가 코드 서명 문제로 실패할 수 있다.

권장 패턴:

- 브라우저 런타임: ChatGPT 조작, asset 다운로드만 담당
- 로컬 Node 스크립트: 이미지 리사이즈, 오디오 합성, FFmpeg 렌더링 담당

즉, 브라우저 쪽에서는 원본 이미지를 저장하고, 후처리는 `src/alignedLongformMedia.mjs` 같은 로컬 렌더러에서 처리한다.

## 보안 팁

절대 커밋하면 안 되는 것:

- `.chatgpt-browser-profile*/`
- `.chatgpt-chrome-cdp-profile/`
- `.env`
- OAuth token 파일
- `out/` 렌더 결과물

브라우저 프로필에는 쿠키, 로그인 세션, 히스토리, 자동완성 DB가 들어갈 수 있다. 반드시 `.gitignore`에 넣는다.

## 현재 프로젝트 명령

ChatGPT 외부 Chrome/CDP 기반:

```bash
npm run chatgpt:chrome-longform-script
npm run chatgpt:chrome-longform-images -- --force
npm run longform:matched-render
```

국장 ETF 고정 플랜:

```bash
npm run korea:etf-plan
npm run longform:korea-etfs
```

Gemini 8초 무음 컷어웨이 준비:

```bash
npm run gemini:video-prep -- --scenes=1,5,9
```

이 명령은 Gemini 하루 생성 제한을 고려해 최대 3개 씬만 준비한다.

- Gemini 업로드용 입력 이미지: `out/gemini-video-inputs/scene-XX.png`
- Gemini 붙여넣기용 프롬프트: `out/gemini-video-prompts.md`
- 저장해야 할 결과 영상 위치: `out/gemini-videos/scene-XX.mp4`

Gemini에서는 각 이미지를 올리고 해당 씬 프롬프트를 붙여넣는다. 프롬프트에는 반드시 8초, 16:9, 무음, 카메라 흔들림 금지, 읽을 수 있는 글자/숫자/로고 금지, 하단 자막 안전 영역 유지 조건을 넣는다.

다운로드한 Gemini 영상은 아래처럼 저장한다.

```text
out/gemini-videos/scene-01.mp4
out/gemini-videos/scene-05.mp4
out/gemini-videos/scene-09.mp4
```

이후 렌더:

```bash
OPENAI_TTS_VOICE=nova npm run longform:matched-render
```

`src/alignedLongformMedia.mjs`는 `out/gemini-videos/scene-XX.mp4`를 먼저 찾고, 없으면 `out/heygen/scene-XX.mp4`를 찾는다. 컷어웨이 영상은 최종 합성에서 `-an` 옵션으로 오디오를 제거하므로, Gemini가 음성을 붙여도 유튜브 영상에는 무음 비주얼로만 들어간다.

이번 in-app browser 방식은 현재 Codex Browser 플러그인에서 직접 진행한 수동-자동 혼합 흐름이다. 다음 단계에서는 이를 별도 스크립트로 감싸서 “스크립트 생성 → 이미지 생성 → asset 저장 → 렌더”를 한 명령으로 묶는 것이 좋다.

## 다음 개선 포인트

- Remotion 기반 컴포지션으로 렌더러 전환
- 씬별 대사 확장 요청을 자동 분할
- 이미지 생성 실패 시 해당 씬만 재시도
- `pageAssets`에서 잘못된 작은 아이콘을 걸러내는 휴리스틱 강화
- 생성 이미지와 씬 대본 매칭 검수용 preview grid 생성
- 최종 업로드 전 `private` 상태로만 YouTube 업로드

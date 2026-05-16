# JEPQ YouTube Automation Agent

JEPQ 월 100만 원 콘텐츠를 자동으로 만드는 로컬 에이전트입니다.

파이프라인:

1. JEPQ/환율/배당 가정으로 계산 스냅샷 생성
2. OpenAI Responses API로 숏폼 영상 플랜 생성
3. OpenAI TTS로 한국어 내레이션 생성
4. 금융형 세로 영상과 썸네일 렌더링
5. YouTube Data API로 비공개 업로드

## Setup

```bash
cp .env.example .env
npm install
```

`.env`에 `OPENAI_API_KEY`를 넣으면 Responses API와 TTS가 활성화됩니다.

ElevenLabs 음성을 쓰려면:

```bash
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

Pexels 클립을 내려받으려면:

```bash
PEXELS_API_KEY=...
npm run stock
```

Coverr/Pixabay도 같은 stock 명령에서 함께 실행됩니다.

```bash
COVERR_API_KEY=...
PIXABAY_API_KEY=...
npm run stock
```

Shotstack 클라우드 렌더링을 쓰려면 공개 URL이 있는 stock manifest가 필요합니다. 로컬 파일을 직접 올리는 렌더러가 아니라, 인터넷에서 접근 가능한 `sourceUrl` 기반으로 렌더합니다.

```bash
SHOTSTACK_API_KEY=...
SHOTSTACK_ENV=stage
npm run generate
npm run stock
npm run shotstack
```

YouTube 업로드를 쓰려면 Google Cloud Console에서 OAuth 클라이언트를 만들고 아래 값을 채웁니다.

```bash
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=http://localhost:53682/oauth2callback
YOUTUBE_PRIVACY_STATUS=private
```

그 다음:

```bash
npm run auth:youtube
```

## Commands

```bash
npm run generate   # 대본/씬/업로드 메타데이터 생성
npm run stock      # Pexels stock clips download
npm run render     # MP4와 썸네일 렌더링
npm run run        # 생성 + 렌더링
npm run shotstack  # Shotstack cloud render submit
npm run shotstack:status -- <renderId>
npm run upload     # YouTube 비공개 업로드
npm test           # API 키 없이 드라이런 렌더링
```

결과물:

- `out/video-plan.json`
- `out/narration.txt`
- `out/narration.mp3`
- `out/captions.srt`
- `out/jepq-monthly-income.mp4`
- `out/thumbnail.jpg`

## Notes

- 기본 업로드는 `private`입니다. 자동 공개보다 검수 후 공개가 안전합니다.
- 새로 만든 미검증 Google API 프로젝트는 YouTube 정책상 업로드 영상이 비공개로 제한될 수 있습니다.
- 영상 문구는 투자 권유가 아니라 정보 제공용으로 생성됩니다.

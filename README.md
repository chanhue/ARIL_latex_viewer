# ARIL 랩미팅 뷰어

랩미팅 회차를 만들고, 각자 자기 이름 아래에 발표 PDF와 영상을 올리면 브라우저에서 그대로
발표 모드로 넘어가는 사이트. PDF를 그냥 띄우는 게 아니라 **pdf.js로 직접 렌더링**하기
때문에, 슬라이드 안의 하이퍼링크를 읽어서 그 자리에 진짜 `<video>` 를 얹을 수 있다.

## 폴더 구조

랩미팅 하나가 폴더 하나다. 그 안에 사람별 폴더가 있고, 영상은 `figs/` 에 들어간다.

```
26.09.02 LAB Meeting/
├── 김찬희/
│   ├── slides.pdf
│   └── figs/
│       ├── demo.mp4
│       └── ablation.mp4
└── 홍길동/
    ├── slides.pdf
    └── figs/
        └── result.mp4
```

`figs/` 는 LaTeX 프로젝트가 그림을 두는 자리와 같다. 그래서 `\href{figs/demo.mp4}{...}`
라고 쓰면 소스 트리와 업로드된 폴더가 같은 경로를 가리키게 된다. (매칭은 파일 이름만
비교하므로 경로가 꼭 일치해야 하는 건 아니지만, 이렇게 두면 읽기 좋다.)

폴더 이름은 날짜에서 자동으로 만들어진다. 같은 날 두 번째 회차는 `(2)` 가 붙어서
폴더가 겹치지 않는다.

## 영상을 슬라이드에 넣는 법

PDF의 하이퍼링크는 텍스트가 아니라 **위치 사각형(rect) + URI 를 가진 주석**이다.
pdf.js의 `page.getAnnotations()` 로 이걸 읽어서, URI가 가리키는 파일명이 함께 올린 영상과
일치하면 그 rect 위치에 영상 플레이어를 정확히 겹쳐 놓는다.

LaTeX 쪽에서는 이렇게만 쓰면 된다.

```latex
\usepackage{hyperref}

% 썸네일 이미지에 링크를 걸면 그 이미지 크기가 곧 영상 크기가 된다
\href{run:figs/demo.mp4}{\includegraphics[width=0.6\textwidth]{figs/demo_thumb.png}}

% 반복 재생 (음소거는 자동)
\href{run:figs/demo.mp4?loop}{\includegraphics[width=0.6\textwidth]{figs/demo_thumb.png}}

% 슬라이드가 넘어오면 바로 재생
\href{run:figs/demo.mp4?autoplay&loop}{\includegraphics[width=0.6\textwidth]{figs/demo_thumb.png}}
```

그리고 사이트에서 PDF와 `demo.mp4` 를 같이 업로드하면 끝.

**링크가 처리되는 규칙** (`src/lib/link-match.mjs`, 테스트는 `tests/link-match.test.mjs`)

| 링크 | 결과 |
| --- | --- |
| 파일명이 업로드한 영상과 일치 | 그 자리에서 영상 재생 |
| 영상 확장자 + 절대 http(s) 주소 | 원격 주소를 그대로 재생 |
| 그 외 일반 URL | 평범한 하이퍼링크 |
| `run:`/`file:` 인데 올린 파일이 없음 | 아무것도 표시하지 않음 (죽은 링크) |

`run:`, `file:`, `video:` 접두사와 경로·쿼리·프래그먼트는 알아서 벗겨내고, 대소문자와
한글 파일명도 맞춰준다. 그래서 `figs/demo.mp4` 든 `run:demo.mp4` 든 똑같이 붙는다.

영상은 언제나 **슬라이드 그 자리에서** 재생된다. 링크가 단어 크기처럼 작아서 플레이어를
그대로 넣을 수 없으면, 그 링크의 중심을 기준으로 슬라이드 가로 30%(16:9) 크기까지 키운
플레이어를 슬라이드 안쪽에 얹는다. 영상을 더블클릭하면 크게 볼 수 있다(아무 데나 누르면 닫힌다).

발표 모드(전체화면)에서 영상을 다시 전체화면으로 띄우면 전체화면이 두 겹이 되는데, Esc는
스펙상 "한 겹 뒤로"가 아니라 전체화면을 통째로 끝내므로 발표에서까지 튕겨 나간다. Esc는
브라우저 몫이라 가로챌 수 없어서, 그 상태를 감지하면 발표 전체화면을 곧바로 다시 요청한다.
브라우저가 새 사용자 제스처를 요구하며 거부하면 그냥 발표 모드가 종료된다.

## 쓰는 흐름

1. **새 랩미팅** 에서 날짜를 고른다. 발표자 이름을 미리 넣어두면 빈 슬롯이 생기고,
   회차 페이지에서 누가 아직 안 올렸는지 한눈에 보인다. 안 넣어도 된다
2. 각자 **올리기** 로 자기 이름 아래에 PDF와 영상을 올린다. 미리 등록되지 않은
   이름으로 올리면 슬롯이 그때 만들어진다
3. 발표할 때 **발표** 버튼 → 전체화면

같은 이름으로 다시 올리면 기존 자료를 갈아치운다. 발표 10분 전에 오타를 발견했을 때
필요한 동작이다.

## 실행

```bash
npm install
npm run dev          # http://localhost:4321
```

설정 파일 없이 바로 돈다. 업로드된 파일은 `.data/blobs/`, 메타데이터는 `.data/db.json`.

### 데모 자료 만들어서 열어보기

```bash
npm run dev          # 한쪽 터미널
npm run demo         # 다른 터미널
```

랩미팅 하나를 만들고, 위 4가지 링크 규칙을 전부 담은 5쪽짜리 PDF와 8초짜리 테스트 영상을
그 안에 올린다. 발표자 두 명 중 한 명은 일부러 빈 슬롯으로 둔다.

### 테스트

```bash
npm test             # 링크 매칭 · Range 파싱 · 세션 · 폴더 이름 (의존성 없이 node --test)
npm run typecheck
```

## 발표 모드 단축키

| 키 | 동작 |
| --- | --- |
| `→` `Space` `PageDown` | 다음 슬라이드 |
| `←` `PageUp` | 이전 슬라이드 |
| `Home` `End` | 처음 / 끝 |
| `F` | 발표 모드(전체화면) 토글 |
| `B` | 화면 끄기 (질문 받을 때) |
| `G` | 슬라이드 목록 |
| `?` | 단축키 도움말 |

영상에 포커스가 있을 때는 `Space` 와 `←/→` 를 영상이 가져간다 (재생/탐색). 슬라이드를
넘기면 이전 슬라이드의 영상은 자동으로 멈춘다.

## 접근 제어

`LAB_PASSWORD` 환경변수를 설정하면 **랩 공용 비밀번호 하나로 사이트 전체가 잠긴다.**
설정하지 않으면 미들웨어가 그냥 비켜서므로, 로컬 개발과 랩 내부 서버는 설정 없이 그대로
쓰면 된다.

```bash
# .env.local
LAB_PASSWORD=우리랩비밀번호
```

- 로그인하면 30일짜리 세션 쿠키가 발급된다 (httpOnly, 서명됨)
- 세션은 **비밀번호로 서명**한다. 즉 비밀번호를 바꾸면 기존 세션이 전부 무효가 된다.
  누가 랩을 나갔을 때 필요한 동작이다
- 페이지는 `/login` 으로 리다이렉트되고, API는 `401` 을 반환한다
- 헤더의 **나가기** 버튼으로 세션을 지운다

로직은 `src/lib/auth.mjs` 에 있고 `tests/auth.test.mjs` 로 검증한다 (위조된 만료 시각,
만료된 세션, 비밀번호 변경 시 무효화 등). 미들웨어가 Edge 런타임에서 도는 탓에
`node:crypto` 를 못 쓰므로 Web Crypto만 사용한다.

**한 가지 한계.** Vercel에 배포하면 업로드된 파일은 Blob CDN의 공개 URL에 올라가고,
그 URL 자체는 이 비밀번호 뒤에 있지 않다. 주소를 추측하기는 사실상 불가능하지만, 링크가
유출되면 비밀번호 없이도 열린다. 파일까지 완전히 막아야 하는 자료라면 랩 서버에 직접
띄우는 쪽을 택해야 한다 (그 경우 `/api/files/*` 도 미들웨어가 막아준다).

## 배포 (Vercel)

**코드 수정 없이 환경변수만으로 전환됩니다.** 두 어댑터가 각각 환경변수 유무를 보고 갈립니다.

| 환경변수 | 없을 때 (로컬) | 있을 때 (Vercel) |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | 파일을 `.data/blobs/` 에 저장 | 브라우저가 Blob으로 **직접 업로드** |
| `DATABASE_URL` | 메타데이터를 `.data/db.json` 에 | Neon Postgres (테이블 자동 생성) |
| `LAB_PASSWORD` | 누구나 접속 가능 | 공용 비밀번호로 사이트 전체를 막음 |

### 1. 프로젝트 임포트

1. [vercel.com](https://vercel.com) 에 GitHub 계정으로 로그인
2. **Add New…** → **Project**
3. Import Git Repository 목록에서 이 저장소를 고른다
4. Framework Preset이 **Next.js** 로 자동 인식되는지만 확인한다. Build Command와 Output
   Directory는 건드리지 않는다
5. **Deploy**

첫 배포는 성공하지만 **아직 업로드는 되지 않는다.** 저장할 스토어가 없고 Vercel의
파일시스템은 쓰기가 불가능하기 때문이다. 목록 페이지는 빈 상태로 정상 표시된다.

### 2. Blob 스토어 붙이기 (파일 저장용)

1. 프로젝트 → 사이드바 **Storage** → **Create Database** → **Blob**
2. **Continue** 를 누르면 접근 수준을 묻는다. 반드시 **Public** 을 고른다
3. 이름은 아무거나 (예: `aril-slides`) → **Create a new Blob store**
4. 토큰을 넣을 환경을 고른다. Production / Preview 는 기본 선택되어 있고,
   로컬에서 `vercel env pull` 로 받아 쓸 생각이면 **Development** 도 체크한다

> **Public을 골라야 하는 이유.** 이 앱은 슬라이드와 영상을 `<canvas>` 와 `<video>` 로
> 브라우저에서 직접 불러온다. Private 스토어는 파일마다 서명된 URL을 서버에서 발급받아야
> 하는데, 지금 구조는 저장된 URL을 그대로 쓰기 때문에 Private으로 만들면 동작하지 않는다.
> 대신 파일 URL은 로그인 뒤에 있지 않다 — [접근 제어](#접근-제어)의 한계 항목 참고.

연결하면 환경변수 세 개가 자동으로 생긴다.

| 변수 | 용도 |
| --- | --- |
| `BLOB_STORE_ID` | 스토어 식별자 |
| `VERCEL_OIDC_TOKEN` | 서버 측 접근용 단기 토큰 (자동 갱신) |
| `BLOB_READ_WRITE_TOKEN` | 장기 토큰. **브라우저 직접 업로드 토큰 발급에 필요** |

이 앱은 `BLOB_READ_WRITE_TOKEN` 의 존재 여부로 업로드 방식을 가른다. 셋 다 자동으로
들어오므로 직접 넣을 것은 없다.

### 3. Neon Postgres 붙이기 (목록 저장용)

1. 같은 **Storage** 탭 → **Create Database** → **Neon** (Serverless Postgres)
2. 리전은 가까운 곳을 고른다 (Singapore 또는 Tokyo)
3. **Connect Project** 로 연결
4. 환경변수에 `DATABASE_URL` 이 생겼는지 확인한다. `DATABASE_URL_UNPOOLED`, `PGHOST`,
   `POSTGRES_*` (구버전 호환용) 등이 함께 생기지만 이 앱이 보는 것은 `DATABASE_URL`
   하나뿐이다. 이건 PgBouncer 를 거치는 풀링된 연결 문자열이고, 서버리스 환경에서
   쓰기에 맞는 쪽이다

테이블은 첫 요청 때 `CREATE TABLE IF NOT EXISTS` 로 자동 생성된다. SQL을 직접 실행할
일은 없다.

### 4. 재배포 — 빠뜨리기 쉬운 단계

환경변수는 **빌드 시점에 주입**되므로, 스토어를 연결한 것만으로는 이미 배포된 버전에
반영되지 않는다.

**Deployments** 탭 → 맨 위 배포의 `⋯` → **Redeploy**

### 5. 제대로 붙었는지 확인

`/upload` 에서 PDF와 mp4를 하나씩 올려본다.

| 확인할 것 | 정상 | 이상하면 |
| --- | --- | --- |
| 업로드 중 **진행률 %** 가 보이는가 | Blob 직접 업로드가 동작 중 | `BLOB_READ_WRITE_TOKEN` 미반영 → 4단계 재배포 |
| 새로고침 후에도 목록에 남는가 | Postgres 동작 중 | `DATABASE_URL` 미반영 → 4단계 재배포 |
| 4.5MB 넘는 영상이 올라가는가 | 직접 업로드 경로 | 413이 뜨면 아직 multipart 경로를 타는 중 |

진행률 표시는 Blob 직접 업로드 경로에서만 나온다. 그래서 **진행률이 보이는지가 곧
설정이 제대로 됐는지의 신호**다.

### 그 밖에 알아둘 것

- **`LAB_PASSWORD` 를 반드시 설정한다.** 설정하지 않으면 주소를 아는 사람은 누구나
  자료를 보고 올릴 수 있고, 더 나쁘게는 `/api/blob-upload` 가 **아무에게나 Blob 업로드
  토큰을 내준다** — 남의 파일이 우리 스토어에 쌓이고 요금이 나간다. Settings →
  Environment Variables 에서 추가한 뒤 재배포한다. [접근 제어](#접근-제어) 참고
- 무료 티어는 랩 규모에 충분하지만 Blob은 **저장 용량과 전송량에 한도**가 있다. 큰 영상을
  계속 쌓을 거라면 Storage 탭에서 사용량을 가끔 확인하는 게 좋다
- 함수 실행 시간 제한은 신경 쓸 필요 없다. 파일은 브라우저에서 Blob으로 직접 가고,
  서버 함수는 DB에 한 줄 쓰는 게 전부다
- Vercel 함수 리전을 Neon과 같은 곳에 두면 응답이 빨라진다.
  Settings → Functions → Region

### 왜 직접 업로드인가

Vercel의 서버리스 함수는 요청 본문을 **4.5MB까지만** 받습니다. 200MB짜리 결과 영상은
서버를 통과할 수가 없습니다. 그래서 `BLOB_READ_WRITE_TOKEN` 이 있으면 업로드 폼이
`@vercel/blob/client` 의 `upload()` 로 **브라우저 → Blob** 으로 파일을 바로 올리고,
서버에는 URL만 넘겨 기록합니다 (`POST /api/presentations`). 진행률 표시도 이 경로에서만
나옵니다. 토큰 발급은 `/api/blob-upload` 가 하며, 여기서 확장자와 500MB 상한을 검사합니다.

`POST /api/presentations` 는 Blob 호스트의 URL만 받아들입니다. 그렇지 않으면 아무 URL이나
슬라이드로 등록할 수 있게 됩니다.

### 랩 서버에 직접 띄우는 경우

```bash
npm run build && npm start     # http://<랩서버>:4321
```

환경변수를 아무것도 설정하지 않으면 파일과 DB가 전부 디스크에 남습니다. 용량 제한도
비용도 없으니, 외부 접속이 필요 없다면 이쪽이 가장 단순합니다.

## 구조

```
src/lib/meeting.mjs        폴더 이름 / 저장 경로 규칙 (순수 함수, 테스트됨)
src/lib/link-match.mjs     링크 -> 영상 판정 (순수 함수, 테스트됨)
src/lib/http-range.mjs     Range 헤더 파싱 (순수 함수, 테스트됨)
src/lib/auth.mjs           공용 비밀번호 세션 (순수 함수, 테스트됨)
src/middleware.ts          LAB_PASSWORD 가 있으면 전 경로를 막음
src/lib/storage.ts         로컬 디스크 <-> Vercel Blob
src/lib/db/index.ts        환경변수를 보고 백엔드 선택
src/lib/db/json.ts           .data/db.json  (로컬)
src/lib/db/postgres.ts       Neon Postgres  (Vercel)
src/components/Deck.tsx    pdf.js 렌더링 + 영상 오버레이 + 발표 모드
src/components/PageThumb.tsx  슬라이드 목록 썸네일 (동시 렌더 3개로 제한)
src/lib/slots.ts           사람 슬롯 찾기 / 만들기 / 채우기
src/components/MeetingSlots.tsx  회차 안의 사람 목록
src/components/UploadForm.tsx    업로드 폼 (직접 업로드 / multipart 양쪽)
src/app/api/files/         로컬 파일 서빙 (영상 탐색을 위한 Range 지원)
src/app/api/upload/        multipart 업로드 (로컬)
src/app/api/blob-upload/   Blob 업로드 토큰 발급 (Vercel)
src/app/api/meetings/      회차 만들기 / 조회 / 삭제
src/app/api/presentations/ 슬롯 등록 / 조회 / 삭제
src/app/api/login/         로그인 / 로그아웃
```

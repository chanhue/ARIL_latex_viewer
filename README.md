# ARIL 랩미팅 뷰어

발표 PDF를 올리면 브라우저에서 그대로 발표 모드로 넘어가는 사이트. PDF를 그냥 띄우는 게
아니라 **pdf.js로 직접 렌더링**하기 때문에, 슬라이드 안의 하이퍼링크를 읽어서 그 자리에
진짜 `<video>` 를 얹을 수 있다. 랩미팅에서 결과 영상을 슬라이드와 같이 보여주는 게 목적.

## 어떻게 동작하나

PDF의 하이퍼링크는 텍스트가 아니라 **위치 사각형(rect) + URI 를 가진 주석**이다.
pdf.js의 `page.getAnnotations()` 로 이걸 읽어서, URI가 가리키는 파일명이 함께 올린 영상과
일치하면 그 rect 위치에 영상 플레이어를 정확히 겹쳐 놓는다.

LaTeX 쪽에서는 이렇게만 쓰면 된다.

```latex
\usepackage{hyperref}

% 썸네일 이미지에 링크를 걸면 그 이미지 크기가 곧 영상 크기가 된다
\href{run:demo.mp4}{\includegraphics[width=0.6\textwidth]{demo_thumb.png}}

% 반복 재생 (음소거는 자동)
\href{run:demo.mp4?loop}{\includegraphics[width=0.6\textwidth]{demo_thumb.png}}

% 슬라이드가 넘어오면 바로 재생
\href{run:demo.mp4?autoplay&loop}{\includegraphics[width=0.6\textwidth]{demo_thumb.png}}
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
한글 파일명도 맞춰준다.

링크가 **단어 크기처럼 작으면** 플레이어를 넣을 수 없으므로 ▶ 배지로 바뀌고, 누르면
전체화면 라이트박스로 재생된다. 기준은 슬라이드 대비 가로·세로 12% 이상.

## 실행

```bash
npm install
npm run dev          # http://localhost:4321
```

설정 파일 없이 바로 돈다. 업로드된 파일은 `.data/blobs/`, 메타데이터는 `.data/db.json`.

### 데모 자료 만들어서 열어보기

```bash
npm run dev          # 한쪽 터미널
npm run demo         # 다른 터미널 — 데모 PDF와 영상을 만들어서 업로드까지 한다
```

`npm run demo` 는 위 4가지 링크 규칙을 전부 담은 5쪽짜리 PDF와 8초짜리 테스트 영상을
만들어 올린다. 링크 → 영상 변환이 실제로 되는지 눈으로 확인하는 용도.

### 테스트

```bash
npm test             # 링크 매칭 + Range 파싱 (의존성 없이 node --test)
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

1. 프로젝트 → **Storage** 탭 → **Create Database** → **Blob**
2. 이름은 아무거나 (예: `aril-slides`) → **Create**
3. 만들어진 스토어에서 **Connect Project** 로 이 프로젝트에 연결한다.
   환경은 Production / Preview / Development 를 **전부** 체크
4. Settings → Environment Variables 에 `BLOB_READ_WRITE_TOKEN` 이 생겼는지 확인

### 3. Neon Postgres 붙이기 (목록 저장용)

1. 같은 **Storage** 탭 → **Create Database** → **Neon** (Serverless Postgres)
2. 리전은 가까운 곳을 고른다 (Singapore 또는 Tokyo)
3. **Connect Project** 로 연결
4. 환경변수에 `DATABASE_URL` 이 생겼는지 확인한다. `POSTGRES_URL`, `PGHOST` 등이 함께
   생기지만 이 앱이 보는 것은 `DATABASE_URL` 하나뿐이다

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
  자료를 보고 올릴 수 있다. Settings → Environment Variables 에서 추가한 뒤 재배포하면
  된다. 자세한 내용은 위의 [접근 제어](#접근-제어) 참고
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
src/components/UploadForm.tsx  업로드 폼 (직접 업로드 / multipart 양쪽)
src/app/api/files/         로컬 파일 서빙 (영상 탐색을 위한 Range 지원)
src/app/api/upload/        multipart 업로드 (로컬)
src/app/api/blob-upload/   Blob 업로드 토큰 발급 (Vercel)
src/app/api/presentations/ 목록 / 등록 / 삭제
src/app/api/login/         로그인 / 로그아웃
```

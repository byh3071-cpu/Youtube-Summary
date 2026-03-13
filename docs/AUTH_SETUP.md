# AUTH / Supabase / OAuth 설정 가이드

이 문서는 `Youtube-Summary` 앱이 동작하기 위해 필요한 **Supabase · Google OAuth · 환경변수** 설정을 정리한 체크리스트입니다.  
로컬/운영 환경 모두에서 이 문서에 따라 설정했는지 점검하는 용도로 사용하세요.

---

## 1. 환경별 기본 개념

- **로컬(Local)**: 개발자가 자신의 PC에서 `npm run dev`로 실행하는 환경
- **운영(Production)**: 실제 사용자가 접속하는 배포 환경 (ex. Vercel, 자체 서버 등)

각 환경마다 **동일한 Supabase 프로젝트**를 쓰더라도, 최소한 아래는 분리되어야 합니다.

- 배포 환경별 **리다이렉트 URL / 사이트 URL**
- 환경변수 값 관리(누가 수정할 수 있는지, 어디에 저장하는지)

---

## 2. 필수 환경 변수 목록

이 저장소 루트의 `.env.example`를 참고해 아래 값을 각 환경에 맞게 채워 넣습니다.

- **공통**
  - `YOUTUBE_API_KEY`
  - `REVALIDATE_SECRET`
  - `GEMINI_API_KEY`

- **Supabase (서버 전용)**
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`  
    - Service Role 키는 **반드시 서버 환경 변수**로만 설정하고, 브라우저 번들에 노출되지 않도록 합니다.

- **Supabase (클라이언트 공개용)**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

로컬 개발 시에는 `.env.local`에, 운영 환경에서는 Vercel/서버의 환경변수 설정 화면에 각각 등록합니다.

---

## 3. Supabase 프로젝트 설정 체크리스트

1. Supabase 프로젝트 생성 후 **Project URL / API Keys** 확인
2. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 환경변수로 등록
3. `auth` 설정에서 **Redirect URLs**에 아래 주소를 추가
   - 로컬: `http://localhost:3000/auth/callback`
   - 운영: `https://{프로덕션 도메인}/auth/callback`
4. OAuth 공급자(Google) 활성화 및 클라이언트 ID/Secret 입력

---

## 4. Google OAuth 설정 체크리스트

1. Google Cloud Console에서 OAuth 클라이언트(ID/Secret) 발급
2. 승인된 리디렉션 URI(Authorized redirect URIs)에 아래 주소 추가
   - 로컬: `http://localhost:3000/auth/callback`
   - 운영: `https://{프로덕션 도메인}/auth/callback`
3. Supabase의 Google Provider 설정에 같은 값 복사

---

## 5. 변경 관리 & 장애 대응 메모

- **변경 관리**
  - Supabase URL/API Key, OAuth Redirect URI를 변경할 때는
    1. 로컬에서 `.env.local`을 수정 후 인증 플로우 테스트
    2. 스테이징/테스트 환경이 있다면 동일하게 검증
    3. 마지막으로 운영 환경 변수 변경
- **장애 발생 시 확인 순서**
  1. `/auth/callback` 응답의 `auth_error`, `auth_error_hint` 쿼리 파라미터 확인
  2. Supabase Auth 로그 및 Google Cloud OAuth 로그에서 에러 유형 확인
  3. 이 문서의 체크리스트를 다시 보며 URL/Key 값 오타·불일치 여부 점검


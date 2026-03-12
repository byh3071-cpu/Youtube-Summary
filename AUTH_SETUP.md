# Google 로그인 설정 체크리스트

구글 로그인이 안 될 때 아래 **세 가지를 모두** 확인하세요.

## 1. Supabase – Redirect URLs

- **Supabase 대시보드** → **Authentication** → **URL Configuration**
- **Redirect URLs**에 다음을 **정확히** 추가:
  - 로컬: `http://localhost:3000/auth/callback`
  - 배포 시: `https://당신도메인/auth/callback`
- **Save** 클릭

## 2. Google Cloud Console – 리디렉션 URI

- **Google Cloud Console** → **APIs & Services** → **사용자 인증 정보**
- **OAuth 2.0 클라이언트 ID** 중 **웹 애플리케이션** 타입 선택 (없으면 새로 만들기)
- **승인된 리디렉션 URI**에 **Supabase 콜백 주소** 추가:
  ```
  https://<프로젝트ID>.supabase.co/auth/v1/callback
  ```
  - `<프로젝트ID>`: Supabase 대시보드 URL 또는 `.env`의 `NEXT_PUBLIC_SUPABASE_URL`에서 확인  
    예: `https://abcdefgh.supabase.co` → `https://abcdefgh.supabase.co/auth/v1/callback`
- **저장**

## 3. Supabase – Google Provider (가장 많이 빠지는 단계)

- **Supabase 대시보드** → **Authentication** → **Providers** → **Google**
- **Google 로그인 사용** 켜기
- Google Cloud Console에서 만든 OAuth 클라이언트의 **Client ID**와 **Client Secret**을 **그대로** 붙여넣기
- **Save** 클릭

---

## 다 했는데도 안 될 때

### 4. Google – 승인된 JavaScript 원본

- **Google Cloud Console** → **사용자 인증 정보** → 같은 **OAuth 2.0 클라이언트 ID**(웹 애플리케이션) 클릭
- **승인된 JavaScript 원본**에 다음 추가:
  - `http://localhost:3000` (로컬 개발용)
- **저장** (리디렉션 URI만 있고 JavaScript 원본이 없으면 로그인이 거부될 수 있음)

### 5. Google – OAuth 동의 화면 / 테스트 사용자

- **Google Cloud Console** → **OAuth 동의 화면**
- **게시 상태**가 **테스트**이면 → **테스트 사용자**에 로그인할 **본인 Google 계정 이메일** 추가
- (프로덕션으로 발행하면 테스트 사용자 목록 불필요)

### 6. 확인할 것

- Supabase **Providers → Google**에 붙여넣은 **Client ID**와 **Client Secret**이, Google Cloud에서 **리디렉션 URI를 추가한 그 OAuth 클라이언트** 것과 **완전히 동일**한지 확인 (앞뒤 공백 없이).
- **시크릿/프라이빗 창**에서 `http://localhost:3000` 접속 후 **Google로 로그인** 다시 시도.
- `npm run dev` 터미널에서 **Google로 로그인** 클릭 직후:
  - `[auth/callback] { hasCode: false, ... }` → Supabase가 code를 안 넘긴 것 → **2, 3, 4번** 다시 확인.
  - `[auth/callback] { hasCode: true, ... }` → code는 왔는데 exchange 실패 → **3번**(Client ID/Secret)과 **5번**(테스트 사용자) 확인.

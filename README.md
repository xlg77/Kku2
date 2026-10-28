# 끄투 프리서버 (GitHub Pages / React)

[JJoriping/KKuTu](https://github.com/JJoriping/KKuTu) 의 클래식 규칙(끝말잇기·쿵쿵따·앞말잇기·영어 끝말잇기/3글자), 점수식, 봇 AI, 단어 DB를
브라우저에서 돌아가도록 옮긴 **정적 웹앱**입니다. 서버·DB 없이 GitHub Pages 에서 동작하며, 봇과 대전합니다.

> GitHub Pages 는 정적 호스팅이라 다른 사람과의 실시간 멀티플레이(WebSocket 서버)는 불가능합니다.

## 배포
1. 이 폴더를 GitHub 저장소(`main` 브랜치)에 push
2. 저장소 **Settings → Pages → Source: GitHub Actions**
3. push 하면 `.github/workflows/deploy.yml` 이 테스트·빌드·배포합니다.

## 개발
```
npm install
npm run dev     # 개발 서버
npm test        # 엔진 테스트 (봇 시뮬레이션 포함, 약 20초)
npm run build   # dist/ 생성
```

## 단어 데이터 다시 만들기
원본 `db.sql` 을 프로젝트 루트에 두고 `npm run words` (→ `public/data/ko.txt`, `en.txt`).

## 라이선스
원본과 같은 GPL-3.0 (`LICENSE`). 영어 사전은 Princeton WordNet 자료를 포함합니다.

## 관리자 단어 추가 (TSV)
`words/custom.tsv` 에 단어를 적어 push 하면, 배포 때 사전에 합쳐집니다. 저장소에 쓰기 권한이 있는 사람(=관리자)만 가능합니다.
열: `단어 ⇥ 언어(ko|en, 비우면 자동) ⇥ 외래어(0/1) ⇥ 어인정(0/1) ⇥ 표준(0/1)` — 첫 줄 헤더는 선택, `#` 줄은 주석.
형식이 틀린 줄은 빌드 로그에 "건너뜀"으로 표시됩니다.

## 계정 / 전적 / 랭킹 (Supabase + Google 로그인)
- 백엔드: Supabase 프로젝트 `kkutu-multiplayer` (`src/supabase.js`). 테이블 `profiles`, `match_history`, 함수 `record_game` (RLS·컬럼 권한으로 클라이언트가 통계를 직접 쓰지 못함).
- Google 로그인 설정 (최초 1회, 대시보드에서):
  1. Google Cloud Console → OAuth 클라이언트 ID(웹 애플리케이션) 생성
     - 승인된 리디렉션 URI: `https://bwekwqqeedpwefesjvlu.supabase.co/auth/v1/callback`
  2. Supabase 대시보드 → Authentication → Sign In / Providers → Google 켜고 Client ID / Secret 입력
  3. Authentication → URL Configuration
     - Site URL: `https://<아이디>.github.io/<저장소>/`
     - Redirect URLs 에 위 주소(와 로컬 테스트용 `http://localhost:5173/`) 추가

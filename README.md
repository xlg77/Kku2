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

## 계정 / 전적 / 랭킹 (Supabase, 아이디+비밀번호)
- 백엔드: Supabase 프로젝트 `kkutu-multiplayer` (`src/supabase.js`). 테이블 `profiles`, `match_history`, 함수 `record_game` (RLS·컬럼 권한으로 클라이언트가 통계를 직접 쓰지 못함).
- 로그인은 **아이디+비밀번호**만 있고 게스트는 없습니다. Supabase Auth 는 이메일이 필요해서 아이디를 `kkutu_<아이디>@users.noreply.github.com` 형태의 내부용 이메일로 바꿔 씁니다 (`src/auth.js`). 메일은 발송되지 않으며 비밀번호 찾기는 불가합니다.
- **필수 대시보드 설정**: Authentication → Sign In / Providers → **Email** → **Confirm email 끄기** (켜져 있으면 가입이 완료되지 않습니다). 같은 화면에서 최소 비밀번호 길이를 올릴 수 있습니다(앱은 6자 이상 요구).

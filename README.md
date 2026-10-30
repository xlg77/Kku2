# 끄투 프리서버 (GitHub Pages / React)

[JJoriping/KKuTu](https://github.com/JJoriping/KKuTu) 의 클래식 규칙(끝말잇기·쿵쿵따·앞말잇기·영어 끝말잇기/3글자), 점수식, 봇 AI, 단어 DB를
브라우저에서 돌아가도록 옮긴 **정적 웹앱**입니다. 서버·DB 없이 GitHub Pages 에서 동작하며, 봇과 대전합니다.

## 멀티플레이 (서버 권위)
방·차례·단어 판정·점수·봇은 전부 Supabase DB 함수(`kk_room_*`)가 처리합니다. 브라우저는 단어를 보내고 0.6초마다 상태를 받아 그리기만 하므로 점수 조작이 불가능하고, 2명 이상 사람이 한 판은 랭킹/전적에 반영됩니다. (`src/multi/room.js`)
- 멀티플레이 사전은 DB의 `kkutu_private.words` 표입니다. **기본 단어는 들어 있지 않습니다.** 관리자 화면에서 직접 업로드한 단어만 멀티에서 쓰입니다. (혼자 하기는 `public/data` 의 기본 사전 + 업로드 단어를 사용)
- 참가자가 25초 이상 응답이 없으면 방에서 빠지고(게임 중이면 봇이 이어받음), 방장은 다음 사람에게 넘어갑니다.

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

## 계정 / 전적 / 랭킹 / 관리자 단어 (Supabase DB, 이메일 없음)
- 백엔드는 Supabase 프로젝트 `kkutu-multiplayer` 의 **Postgres 만** 씁니다. Supabase Auth(이메일)는 쓰지 않고, DB 함수 `kk_signup / kk_login / kk_me / kk_logout / kk_rename / kk_record_game / kk_admin_*` 가 자체 계정을 처리합니다.
- 비밀번호는 DB 안에서 bcrypt 로 저장·검증, 세션 토큰은 SHA-256 해시로만 저장(30일). 로그인 10분에 8회 실패 시 잠금, IP 당 시간당 10회 가입 제한.
- 계정·세션 테이블은 비공개 스키마 `kkutu_private` 에 있어 브라우저에서 직접 읽을 수 없습니다. 랭킹(`profiles`)과 추가 단어(`custom_words`)만 공개 읽기입니다.
- **비밀번호 찾기는 불가능**합니다 (이메일이 없음). 필요하면 관리자가 SQL 로 재설정해야 합니다.
- 관리자 지정: Supabase SQL Editor 에서 `update kkutu_private.accounts set is_admin = true where username = '<아이디>';`
- 관리자로 로그인하면 로비 아래에 "단어 올리기" 패널이 나타납니다 (추가 단어는 DB `custom_words` 에 저장, 재배포 불필요).
- 비밀번호 재설정(관리자용): `update kkutu_private.accounts set password_hash = extensions.crypt('<새 비밀번호>', extensions.gen_salt('bf', 10)) where username = '<아이디>';`

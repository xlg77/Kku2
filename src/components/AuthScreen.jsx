import { useState } from 'react';
import { ID_RE, MIN_PW } from '../auth.js';
import LobbyStage from './LobbyStage.jsx';

export default function AuthScreen({ auth }) {
  const [mode, setMode] = useState('login');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [nick, setNick] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  async function submit(e) {
    e.preventDefault();
    const uid = id.trim().toLowerCase();
    if (!ID_RE.test(uid)) return setErr('아이디는 영문 소문자·숫자·밑줄(_) 3~16자예요');
    if (pw.length < MIN_PW) return setErr(`비밀번호는 ${MIN_PW}자 이상이어야 해요`);
    if (signup) {
      if (pw !== pw2) return setErr('비밀번호가 서로 달라요');
      if (!nick.trim()) return setErr('닉네임을 입력해주세요');
    }
    setErr('');
    setBusy(true);
    const r = signup ? await auth.signUp(uid, pw, nick) : await auth.signIn(uid, pw);
    setBusy(false);
    if (r) setErr(r);
  }

  return (
    <LobbyStage>
      <main className="auth-page">
        <section className="auth-shell" aria-label="Kku2 계정">
          <div className="auth-brand">
            <div className="auth-mark" aria-hidden="true"><span>ㄲ</span><span>2</span></div>
            <p className="auth-kicker">WORD PLAY · MULTIPLAYER</p>
            <h1>글자로 연결되는<br /><em>새로운 플레이</em></h1>
            <p className="auth-description">나만의 계정으로 Kku2에 접속하고<br />친구들과 단어 게임을 시작해 보세요.</p>
            <div className="auth-status"><i /> GAME SERVER ONLINE <span>•</span> KKU2</div>
          </div>

          <form className="auth-card" onSubmit={submit}>
            <div className="auth-card-head">
              <span className="auth-eyebrow">{signup ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</span>
              <h2>{signup ? '계정 만들기' : '다시 만나서 반가워요'}</h2>
              <p>{signup ? '간단한 정보를 입력하고 시작하세요.' : '계정 정보를 입력하고 게임에 참여하세요.'}</p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="로그인 또는 가입">
              <button type="button" role="tab" aria-selected={!signup} className={!signup ? 'active' : ''} onClick={() => { setMode('login'); setErr(''); }}>로그인</button>
              <button type="button" role="tab" aria-selected={signup} className={signup ? 'active' : ''} onClick={() => { setMode('signup'); setErr(''); }}>회원가입</button>
            </div>

            <label className="auth-field">
              <span>아이디</span>
              <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={16} placeholder="아이디를 입력하세요" />
            </label>

            {signup && (
              <label className="auth-field">
                <span>닉네임 <small>게임에 표시되는 이름</small></span>
                <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={12} autoComplete="nickname" placeholder="사용할 닉네임" />
              </label>
            )}

            <label className="auth-field">
              <span>비밀번호</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} placeholder={`비밀번호 ${MIN_PW}자 이상`} />
            </label>

            {signup && (
              <label className="auth-field">
                <span>비밀번호 확인</span>
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" placeholder="비밀번호를 한 번 더 입력하세요" />
              </label>
            )}

            {signup && <p className="auth-warning"><span>!</span> 이메일 없이 가입하므로 비밀번호를 잊으면 복구할 수 없어요. 꼭 기억해 주세요.</p>}
            {(err || auth.error) && <p className="auth-error" role="alert">{err || auth.error}</p>}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? '접속 중…' : signup ? '계정 만들기' : '로그인하고 시작하기'}
              {!busy && <span aria-hidden="true">↗</span>}
            </button>
            <p className="auth-legal">계속 진행하면 Kku2의 게임 이용 규칙을 따르는 것으로 간주돼요.</p>
          </form>
        </section>
        <footer className="auth-footer"><span>KKU2</span> WORD GAME PLATFORM <span>© 2026</span></footer>
      </main>
    </LobbyStage>
  );
}

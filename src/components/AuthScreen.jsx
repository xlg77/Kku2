import { useState } from 'react';
import { ID_RE, MIN_PW } from '../auth.js';

export default function AuthScreen({ auth }) {
  const [mode, setMode] = useState('login'); // login | signup
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
    setErr(''); setBusy(true);
    const r = signup ? await auth.signUp(uid, pw, nick) : await auth.signIn(uid, pw);
    setBusy(false);
    if (r) setErr(r);
  }

  return (
    <main className="lobby">
      <header className="hero">
        <div className="logo" aria-label="끄투"><span>끄</span><span>투</span></div>
        <p className="tagline">글자로 놀자! <b>끄투 프리서버</b></p>
      </header>
      <form className="panel" onSubmit={submit}>
        <div className="seg" role="tablist" aria-label="로그인 또는 가입">
          <button type="button" role="tab" aria-selected={!signup} className={!signup ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>로그인</button>
          <button type="button" role="tab" aria-selected={signup} className={signup ? 'on' : ''} onClick={() => { setMode('signup'); setErr(''); }}>회원가입</button>
        </div>
        <label className="field">
          <span className="field-label">아이디</span>
          <input className="text" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={16} placeholder="영문 소문자·숫자·_ 3~16자" />
        </label>
        {signup && (
          <label className="field">
            <span className="field-label">닉네임 (게임에 표시돼요)</span>
            <input className="text" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={12} autoComplete="nickname" placeholder="한글도 가능, 12자까지" />
          </label>
        )}
        <label className="field">
          <span className="field-label">비밀번호</span>
          <input className="text" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} placeholder={`${MIN_PW}자 이상`} />
        </label>
        {signup && (
          <label className="field">
            <span className="field-label">비밀번호 확인</span>
            <input className="text" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </label>
        )}
        {signup && <p className="note">⚠️ 이메일을 받지 않아서 비밀번호를 잃어버리면 복구할 수 없어요.</p>}
        {(err || auth.error) && <p className="error" role="alert">{err || auth.error}</p>}
        <button className="go" type="submit" disabled={busy}>{busy ? '잠시만요…' : signup ? '가입하고 시작' : '로그인'}</button>
      </form>
    </main>
  );
}

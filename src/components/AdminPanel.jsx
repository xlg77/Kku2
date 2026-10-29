import { useEffect, useMemo, useState } from 'react';
import { parseWords } from '../engine/customWords.js';
import { countCustomWords, uploadCustomWords, deleteCustomWord } from '../auth.js';

export default function AdminPanel() {
  const [text, setText] = useState('');
  const [lang, setLang] = useState('');
  const [total, setTotal] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState('');
  const parsed = useMemo(() => parseWords(text, lang), [text, lang]);

  const refresh = () => countCustomWords().then(setTotal).catch(() => setTotal(null));
  useEffect(() => { refresh(); }, []);

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setText(await f.text());
    e.target.value = '';
  }
  async function upload() {
    if (!parsed.rows.length) return;
    setBusy(true); setStatus('올리는 중…');
    const err = await uploadCustomWords(parsed.rows, (n) => setStatus(`올리는 중… ${n}/${parsed.rows.length}`));
    setBusy(false);
    if (err) return setStatus('⚠️ 실패: ' + err);
    setStatus(`✅ ${parsed.rows.length}개 올렸어요. 새 게임부터 반영돼요`);
    setText(''); refresh();
  }
  async function remove(e) {
    e.preventDefault();
    const w = del.trim().toLowerCase();
    if (!w) return;
    const err = await deleteCustomWord(w);
    setStatus(err ? '⚠️ ' + err : `🗑️ “${w}” 삭제했어요`);
    if (!err) { setDel(''); refresh(); }
  }

  return (
    <section className="panel admin">
      <h2>🔧 관리자: 단어 올리기 <small>추가 단어 {total ?? '?'}개</small></h2>
      <p className="note">한 줄에 하나씩 붙여넣거나 파일(txt/csv/tsv)을 고르세요. 열을 쓰려면 <code>단어,언어,외래어,어인정,표준</code> 순서(탭 또는 쉼표). 언어·나머지 열은 비워도 돼요.</p>
      <textarea className="text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'끄투\n프리서버\nkkutu'} spellCheck={false} aria-label="올릴 단어" />
      <div className="admin-row">
        <label className="ghost filebtn">파일 선택<input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" onChange={onFile} hidden /></label>
        <div className="seg" role="radiogroup" aria-label="언어">
          {[['', '자동'], ['ko', '한국어'], ['en', '영어']].map(([v, n]) => (
            <button type="button" key={v} role="radio" aria-checked={lang === v} className={lang === v ? 'on' : ''} onClick={() => setLang(v)}>{n}</button>
          ))}
        </div>
      </div>
      <p className="note">올릴 단어 <b>{parsed.rows.length}</b>개{parsed.skipped.length > 0 && <> · 건너뜀 <b>{parsed.skipped.length}</b>개 ({parsed.skipped.slice(0, 3).join(' / ')}{parsed.skipped.length > 3 ? ' …' : ''})</>}</p>
      <button className="go" type="button" disabled={busy || !parsed.rows.length} onClick={upload}>{busy ? '올리는 중…' : `DB에 올리기 (${parsed.rows.length})`}</button>
      <form className="rename" onSubmit={remove}>
        <input className="text" value={del} onChange={(e) => setDel(e.target.value)} placeholder="삭제할 추가 단어" aria-label="삭제할 단어" />
        <button className="ghost" type="submit">삭제</button>
      </form>
      {status && <p className="note" role="status">{status}</p>}
    </section>
  );
}

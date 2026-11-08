import { useEffect, useMemo, useState } from 'react';
import { parseWords } from '../engine/customWords.js';
import { countCustomWords, uploadCustomWords, deleteCustomWord, putDictFile, fetchAdminModes, saveCustomMode, uploadModeWords, deleteCustomMode } from '../auth.js';

export default function AdminPanel() {
  const [text, setText] = useState('');
  const [lang, setLang] = useState('');
  const [total, setTotal] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState('');
  const [modes, setModes] = useState([]);
  const [modeId, setModeId] = useState('');
  const [modeName, setModeName] = useState('');
  const [modeDescription, setModeDescription] = useState('');
  const [modeBase, setModeBase] = useState('KSH');
  const [modePublic, setModePublic] = useState(true);
  const [modeText, setModeText] = useState('');
  const modeLang = ['ESH','EKT'].includes(modeBase) ? 'en' : 'ko';
  const modeParsed = useMemo(() => parseWords(modeText, modeLang), [modeText, modeLang]);
  const refreshModes = () => fetchAdminModes().then(setModes).catch((e) => setStatus('⚠️ 모드 목록을 불러오지 못했어요: ' + e.message));
  const parsed = useMemo(() => parseWords(text, lang), [text, lang]);

  const refresh = () => countCustomWords().then(setTotal).catch(() => setTotal(null));
  useEffect(() => { refresh(); refreshModes(); }, []);

  function editMode(m) {
    setModeId(m.id); setModeName(m.name); setModeDescription(m.description || '');
    setModeBase(m.base_mode); setModePublic(!!m.is_public); setModeText('');
    setStatus('모드 설정을 수정 중이에요. 단어 파일을 추가로 올릴 수도 있어요.');
  }
  function resetModeForm() {
    setModeId(''); setModeName(''); setModeDescription('');
    setModeBase('KSH'); setModePublic(true); setModeText('');
  }
  async function onModeFile(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!/\\.txt$/i.test(f.name)) return setStatus('⚠️ 모드 단어장은 TXT 파일만 지원해요.');
    setModeText(await readDictText(f));
  }
  async function saveMode() {
    if (!modeName.trim() || (!modeId && !modeParsed.rows.length)) return setStatus('⚠️ 모드 이름과 유효한 TXT 단어장이 필요해요.');
    setBusy(true); setStatus('모드 저장 중…');
    const saved = await saveCustomMode({ id: modeId, name: modeName, description: modeDescription, base_mode: modeBase, is_public: false });
    if (saved.error) { setBusy(false); return setStatus('⚠️ ' + saved.error); }
    setModeId(saved.id);
    const err = modeParsed.rows.length ? await uploadModeWords(saved.id, modeParsed.rows, (n) => setStatus(`모드 단어 등록 중… ${n}/${modeParsed.rows.length}`)) : null;
    if (err) { setBusy(false); return setStatus('⚠️ 모드는 저장됐지만 단어 등록에 실패했어요: ' + err); }
    const published = await saveCustomMode({ id: saved.id, name: modeName, description: modeDescription, base_mode: modeBase, is_public: modePublic });
    setBusy(false);
    if (published.error) return setStatus('⚠️ 단어는 등록됐지만 공개 설정에 실패했어요: ' + published.error);
    setStatus(`✅ 모드 “${modeName}” 저장 완료${modeParsed.rows.length ? ` · 단어 ${modeParsed.rows.length}개 추가` : ''}`);
    setModeText(''); resetModeForm(); refreshModes();
  }
  async function removeMode(id) {
    if (!confirm('이 모드와 전용 단어장을 모두 삭제할까요?')) return;
    const err = await deleteCustomMode(id);
    if (err) return setStatus('⚠️ ' + err);
    setStatus('🗑️ 모드를 삭제했어요.'); refreshModes();
    if (modeId === id) resetModeForm();
  }
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
  const [dLang, setDLang] = useState('ko');
  const [dFmt, setDFmt] = useState('plain');
  const [dReplace, setDReplace] = useState(true);
  async function readDictText(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let decoded;
    if (bytes[0] === 0xff && bytes[1] === 0xfe) decoded = new TextDecoder('utf-16le').decode(bytes.subarray(2));
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) decoded = new TextDecoder('utf-16be').decode(bytes.subarray(2));
    else {
      try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { decoded = new TextDecoder('euc-kr').decode(bytes); }
    }
    return decoded.replace(/^\uFEFF/, '').replace(/\u0000/g, '');
  }
  async function onDictFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/\.txt$/i.test(f.name)) return setStatus('⚠️ 사전 파일은 .txt 형식만 선택할 수 있어요.');
    if (dReplace && !confirm(`${dLang === 'ko' ? '한국어' : '영어'} 사전을 이 파일 내용으로 통째로 바꿀까요? 기존 ${dLang === 'ko' ? '한국어' : '영어'} 단어는 모두 지워져요.`)) return;
    setBusy(true); setStatus('파일 읽는 중…');
    const result = await putDictFile(dLang, await readDictText(f), dFmt, dReplace, (n, t) => setStatus(`DB에 올리는 중… ${n}/${t}줄`));
    setBusy(false);
    if (typeof result === 'string') return setStatus('⚠️ 실패: ' + result);
    setStatus(`✅ 멀티플레이 사전에 ${result.count.toLocaleString()}개 등록했어요 (유효 ${result.valid.toLocaleString()}개 / 전체 ${result.total.toLocaleString()}줄). 새 게임부터 반영돼요.`);
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
      <h2>🔧 관리자 도구 <small>DB 사전 {total ?? '?'}개</small></h2>
      <div className="admin-dict">
        <h3 className="h2">🎮 사용자 제작 게임 모드</h3>
        <p className="note">기존 규칙을 골라 전용 단어장을 가진 모드를 만들어요. TXT는 한 줄에 단어 하나씩 넣어주세요.</p>
        <div className="field">
          <label className="field-label">모드 이름</label>
          <input className="text" value={modeName} maxLength={24} onChange={(e) => setModeName(e.target.value)} placeholder="예: 동물 이름 끝말잇기" />
        </div>
        <div className="field">
          <label className="field-label">설명</label>
          <input className="text" value={modeDescription} maxLength={120} onChange={(e) => setModeDescription(e.target.value)} placeholder="모드 설명" />
        </div>
        <div className="field">
          <span className="field-label">적용할 기본 규칙</span>
          <div className="seg">
            {Object.entries({KSH:'끝말잇기',KKT:'쿵쿵따',KAP:'앞말잇기',ESH:'영어 끝말잇기',EKT:'영어 3글자'}).map(([v,n]) => <button type="button" key={v} className={modeBase===v?'on':''} onClick={() => setModeBase(v)}>{n}</button>)}
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={modePublic} onChange={(e) => setModePublic(e.target.checked)} /> 저장 후 사용자에게 공개</label>
        <label className="ghost filebtn">전용 TXT 단어장 선택<input type="file" accept=".txt,text/plain" onChange={onModeFile} hidden /></label>
        <p className="note">유효 단어 {modeParsed.rows.length}개{modeParsed.skipped.length ? ` · 제외 ${modeParsed.skipped.length}개` : ''} · {modeLang === 'ko' ? '한국어' : '영어'}</p>
        <div className="admin-row">
          <button className="go" type="button" disabled={busy || !modeName.trim() || (!modeId && !modeParsed.rows.length)} onClick={saveMode}>{busy ? '저장 중…' : modeId ? '모드 수정 및 단어 추가' : '모드 생성'}</button>
          {modeId && <button className="ghost" type="button" onClick={resetModeForm}>취소</button>}
        </div>
        {modes.length > 0 && <div className="mode-list">
          {modes.map((m) => <div className="admin-row" key={m.id}>
            <span><b>{m.name}</b><small>{m.count.toLocaleString()}개 · {m.is_public ? '공개' : '비공개'}</small></span>
            <button className="ghost" type="button" onClick={() => editMode(m)}>수정</button>
            <button className="ghost" type="button" onClick={() => removeMode(m.id)}>삭제</button>
          </div>)}
        </div>}
      </div>
      <p className="note">멀티플레이 사전 파일은 TXT만 지원해요. 일반 단어 목록은 한 줄에 단어 하나씩 저장한 TXT를 선택하세요.</p>
      <div className="admin-dict">
        <h3 className="h2">📚 멀티플레이 사전 통째로 올리기</h3>
        <div className="admin-row">
          <div className="seg" role="radiogroup" aria-label="사전 언어">
            {[['ko', '한국어'], ['en', '영어']].map(([v, n]) => (
              <button type="button" key={v} role="radio" aria-checked={dLang === v} className={dLang === v ? 'on' : ''} onClick={() => setDLang(v)}>{n}</button>
            ))}
          </div>
          <div className="seg" role="radiogroup" aria-label="파일 형식">
            {[['dict', '기본 사전 형식'], ['plain', '한 줄에 단어 하나']].map(([v, n]) => (
              <button type="button" key={v} role="radio" aria-checked={dFmt === v} className={dFmt === v ? 'on' : ''} onClick={() => setDFmt(v)}>{n}</button>
            ))}
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={dReplace} onChange={(e) => setDReplace(e.target.checked)} /> 기존 사전을 지우고 이 파일로 교체 (끄면 단어만 추가·덮어쓰기)</label>
        <label className={'go filebtn' + (busy ? ' disabled' : '')}>사전 파일 선택해서 올리기<input type="file" accept=".txt,text/plain" onChange={onDictFile} disabled={busy} hidden /></label>
        <p className="note">‘기본 사전 형식’은 <code>단어+플래그+표준(0/1)+조회수(0~9)</code>(예: <code>에콜드파리500</code>, 영어는 <code>apple7</code>)이고, ‘한 줄에 단어 하나’는 단어만 적힌 txt예요. 35만 단어도 1분 안팎이에요.</p>
      </div>
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

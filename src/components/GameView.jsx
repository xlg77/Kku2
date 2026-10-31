import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MODES, OPT_LABELS, isChainable } from '../engine/rules.js';
import TimerBar from './TimerBar.jsx';
import Result from './Result.jsx';
import { sfx, isMuted, setMuted, getAudioContext, unlockAudio } from '../sfx.js';

let specialAudioContext = null;
let specialAudioBuffers = null;
let specialAudioLoading = null;
const SPECIAL_SOUNDS = [
  'HEAVENLY%20JUMPSTYLE%20%28mp3cut.net%29.mp3',
  'MONTAGEM%20SUPERSONIC%20-%20KHAOS%20x%20JMILTON%20%28LYRICS%29%20%28mp3cut.net%29.mp3',
  'SPOOKY%202%20%28mp3cut.net%29.mp3',
  'X-COOL%21%20%28mp3cut.net%29.mp3',
];

function unlockSpecialAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    specialAudioContext = getAudioContext();
    void unlockAudio().catch((error) => console.warn('[Kku2] 게임 오디오 잠금 해제 실패:', error));
    if (!specialAudioBuffers && !specialAudioLoading) {
      specialAudioLoading = Promise.all(SPECIAL_SOUNDS.map(async (name) => {
        const response = await fetch('https://raw.githubusercontent.com/xlg77/the-music-cloud/main/' + name, { mode: 'cors', cache: 'force-cache' });
        if (!response.ok) throw new Error('MP3 HTTP ' + response.status + ': ' + name);
        return specialAudioContext.decodeAudioData(await response.arrayBuffer());
      })).then((buffers) => { specialAudioBuffers = buffers; return buffers; })
        .catch((error) => { specialAudioLoading = null; console.warn('[Kku2] 특수 MP3 사전 로드 실패:', error); throw error; });
    }
  } catch (error) {
    console.warn('[Kku2] 오디오 초기화 실패:', error);
  }
}

async function playSpecialAudio() {
  unlockSpecialAudio();
  if (!specialAudioContext) throw new Error('Web Audio를 지원하지 않는 브라우저예요.');
  if (specialAudioContext.state === 'suspended') await specialAudioContext.resume();
  const buffers = specialAudioBuffers || await specialAudioLoading;
  if (specialAudioContext.state === 'suspended') await specialAudioContext.resume();
  const buffer = buffers[Math.floor(Math.random() * buffers.length)];
  const source = specialAudioContext.createBufferSource();
  const gain = specialAudioContext.createGain();
  source.buffer = buffer;
  gain.gain.value = 0.85;
  source.connect(gain).connect(specialAudioContext.destination);
  source.start(0);
}

const ERR = {
  timeout: () => '응답이 없어요. 다시 시도해주세요',
  chain: (g) => g.mode === 'KAP' ? `‘${g.char}’${g.subChar ? ` (또는 ‘${g.subChar}’)` : ''}(으)로 끝나는 단어를 입력하세요` : `‘${g.char}’${g.subChar ? ` (또는 ‘${g.subChar}’)` : ''}(으)로 시작하는 단어를 입력하세요`,
  409: () => '이미 쓴 단어예요',
  404: () => '사전에 없는 단어예요',
  402: () => '이 단어는 이을 수 없는 “한방 단어”예요 (첫 단어)',
  403: () => '매너! 다음 사람이 이을 수 없는 단어예요',
  405: () => '외래어는 쓸 수 없어요',
  406: () => '엄격 모드: 표준 표제어만 쓸 수 있어요',
};

/**
 * 게임 화면. store(subscribe/getSnapshot)가 주는 스냅샷만 그린다.
 * 혼자 하기: store = Game, 멀티플레이: store = 방장이 보내준 상태. submit(text) → Promise<{ok, code}>
 */
export default function GameView({ store, meId, submit: submitFn, record, onExit, onAgain, againLabel, onRecorded, allowPrediction = false }) {
  const s = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [muted, setM] = useState(isMuted());
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState('');
  const [text, setText] = useState('');
  const [pendingPrediction, setPendingPrediction] = useState('');
  const [specialSuccess, setSpecialSuccess] = useState(false);
  const input = useRef(null);
  const histRef = useRef(null);
  const prevLast = useRef(0);
  const mode = MODES[s?.mode || 'KSH'];

  // 사용자의 첫 클릭/터치/키 입력 안에서 Web Audio를 활성화하고 MP3를 미리 불러온다.
  useEffect(() => {
    const unlock = () => { void unlockAudio().catch(() => {}); unlockSpecialAudio(); };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const myTurn = !!s && s.phase === 'turn' && s.seq[s.turn] === meId;
  const curId = s ? s.seq[s.turn] : null;

  // 효과음
  useEffect(() => {
    if (!s || !s.last) return;
    // 서버가 id를 생략하는 경우에도 마지막 성공 이벤트를 구분한다.
    const eventKey = s.last.id ?? [s.last.pid, s.last.word ?? s.chain?.[s.chain.length - 1] ?? '', s.last.score, s.last.ok, s.phase].join('|');
    if (eventKey === prevLast.current) return;
    prevLast.current = eventKey;
    // 서버가 last.word를 생략하면 갱신된 chain의 마지막 단어를 사용한다.
    const successfulWord = typeof s.last.word === 'string' ? s.last.word : (s.last.ok ? s.chain?.[s.chain.length - 1] : '');
    if (s.last.ok && typeof successfulWord === 'string' && Array.from(successfulWord.trim()).length === 20) {
      if (!muted) {
        // 대체 효과음 없이 저장소의 MP3만 재생한다. 로드/재생 오류는 콘솔에 남긴다.
        void playSpecialAudio().catch((error) => console.error('[Kku2] 20글자 특수 MP3 재생 실패:', error));
      }
      setSpecialSuccess(true);
      const timer = setTimeout(() => setSpecialSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
    s.last.ok ? sfx.ok() : sfx.boom();
  }, [s?.last, muted]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (s?.phase === 'roundReady') sfx.round(); if (s?.phase === 'over') sfx.win(); }, [s?.phase]);

  // 공개 구간에서 Enter로 확정한 예측 단어는 내 차례가 서버에 반영된 뒤 제출한다.
  useEffect(() => {
    if (s?.phase !== 'turn' || !pendingPrediction) return;
    if (myTurn) {
      const word = pendingPrediction;
      setPendingPrediction('');
      setText('');
      sendWord(word, true);
    } else {
      setPendingPrediction('');
    }
  }, [s?.phase, s?.turnAt, myTurn, pendingPrediction]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!myTurn) return;
    setMsg('');
    if (!pendingPrediction) input.current?.focus({ preventScroll: true });
  }, [myTurn, s?.turnAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { histRef.current?.scrollTo({ top: histRef.current.scrollHeight, behavior: 'smooth' }); }, [s?.chain?.length]);

  async function sendWord(word, predicted = false) {
    const r = await submitFn(word);
    if (r.ok) { setText(''); setMsg(predicted ? '⚡ 예측샷 성공! 먼저 준비한 단어가 제출됐어요.' : ''); return; }
    if (r.code === 'empty' || r.code === 'turn' || r.code === 'phase') return;
    const m = (ERR[r.code] || (() => '사용할 수 없는 단어예요'))(store.getSnapshot() || s);
    setMsg((predicted ? '예측샷 실패 · ' : '') + m);
    setShake((n) => n + 1); sfx.bad();
    if (!predicted) input.current?.select();
  }

  async function submit(e) {
    e.preventDefault();
    const word = text.trim();
    if (!myTurn) {
      if (allowPrediction && s.phase === 'turnResult' && word) {
        if (!isChainable(s.mode, word, s.char, s.subChar, s.mode === 'KKT' ? 3 : 0)) {
          setMsg('예측 실패 · 공개된 글자에 맞는 단어가 아니에요.');
          setShake((n) => n + 1);
          sfx.bad();
          return;
        }
        setPendingPrediction(word);
        setMsg('⚡ 예측 입력 성공! 내 차례가 시작되면 제출돼요.');
      } else if (allowPrediction && s.phase === 'turn' && word) {
        setMsg('글자가 공개되는 1.25초 동안 Enter를 눌러야 예측샷이 발동해요.');
      }
      return;
    }
    await sendWord(word);
  }

  const toggleMute = () => { setMuted(!muted); setM(!muted); };
  if (!s) return <main className="lobby"><p className="sub" style={{ textAlign: 'center', marginTop: 80 }}>게임을 준비하고 있어요…</p></main>;
  const activeOpts = Object.keys(OPT_LABELS).filter((k) => s.opts && s.opts[k]).map((k) => OPT_LABELS[k][0]);
  const order = s.seq.map((id) => s.players[id]);
  const chain = s.chain || [];
  const recent = chain.slice(-6);

  if (s.phase === 'over') return <><Result s={s} meId={meId} record={record} onExit={onExit} onAgain={onAgain} againLabel={againLabel} onRecorded={onRecorded} />{specialSuccess && <div className="special-success" role="status" aria-live="assertive"><div className="special-success-card"><img src="/Kku2/special-success.svg" alt="20글자 단어 성공 특별 이미지" /><strong>20글자 성공!</strong></div></div>}</>;

  const showChar = s.phase !== 'idle' && s.phase !== 'starting';
  const roundEnd = s.phase === 'roundEnd';

  return (
    <main className="game" onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onPaste={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()} onKeyDown={(e) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.shiftKey && e.key === 'Insert') e.preventDefault();
    }}>
      <header className="topbar">
        <button className="ghost" onClick={() => { if (confirm('게임을 나갈까요?')) onExit(); }} aria-label="나가기">← 나가기</button>
        <div className="top-info">
          <b>{mode.name}</b>
          <span>라운드 {Math.min(s.round || 1, s.rounds)}/{s.rounds}</span>
          <span>연결 {chain.length}</span>
        </div>
        <button className="ghost" onClick={toggleMute} aria-label={muted ? '소리 켜기' : '소리 끄기'}>{muted ? '🔇' : '🔊'}</button>
      </header>

      {specialSuccess && <div className="special-success" role="status" aria-live="assertive"><div className="special-success-card"><img src="/Kku2/special-success.svg" alt="20글자 단어 성공 특별 이미지" /><strong>20글자 성공!</strong></div></div>}
      <TimerBar className="round-bar" label="라운드 남은 시간" since={s.turnAt} total={s.roundTimeLeft} active={s.phase === 'turn'} danger={0.2} />

      <section className={'stage' + (roundEnd ? ' boom' : '')} aria-live="polite">
        {s.phase === 'roundReady' && (
          <div className="banner" key={'r' + s.round}>
            <small>ROUND {s.round}</small>
            <strong>{s.char}{s.subChar ? <em>({s.subChar})</em> : null}</strong>
            {s.mission && <span className="mission">미션 글자 <b>{s.mission}</b></span>}
          </div>
        )}
        {(s.phase === 'turn' || s.phase === 'turnResult' || roundEnd) && (
          <>
            <div className="charbox" key={s.char + chain.length}>
              <span className="big">{mode.lang === 'en' ? s.char.toUpperCase() : s.char}</span>
              {s.subChar && <span className="sub-char">{s.subChar}</span>}
              <span className="dir">{s.mode === 'KAP' ? '(으)로 끝나는' : '(으)로 시작하는'}{s.mode === 'KKT' ? ' 3글자' : ''}</span>
            </div>
            {s.mission && s.mission !== true && <div className="mission">미션 <b>{s.mission}</b></div>}
            {roundEnd && (
              <div className="boomtext">
                <b>💥 {s.players[s.last?.pid]?.name} 시간 초과!</b>
                {s.hint && <span>예시 단어: <u>{s.hint}</u></span>}
              </div>
            )}
          </>
        )}
        {(s.phase === 'idle' || s.phase === 'starting') && <div className="banner"><strong>준비…</strong></div>}
      </section>

      <TimerBar className="turn-bar" label="내 차례 남은 시간" since={s.turnAt} total={s.turnTime} active={s.phase === 'turn'} />

      <div className="hist" ref={histRef} aria-label="지금까지 이은 단어">
        {recent.map((w, i) => {
          const idx = chain.length - recent.length + i;
          return <span key={idx + w} className={'chip' + (i === recent.length - 1 ? ' new' : '')}>{w}</span>;
        })}
        {!chain.length && <span className="hint">첫 단어를 이어보세요!</span>}
      </div>

      <section className="players" aria-label="플레이어">
        {order.map((p) => {
          const lastHere = s.last && s.last.pid === p.id ? s.last : null;
          return (
            <div key={p.id} className={'player' + (curId === p.id && s.phase !== 'roundEnd' ? ' cur' : '') + (p.id === meId ? ' me' : '') + (roundEnd && s.last?.pid === p.id ? ' bomb' : '')}>
              <div className="avatar" style={{ '--h': hue(p.id) }}>{p.name.slice(0, 1)}</div>
              <div className="pinfo">
                <b>{p.name}</b>
                <small>{p.bot ? `봇 · ${['하수', '초보', '중수', '고수', '신'][p.level]}` : p.id === meId ? '나' : '플레이어'}</small>
              </div>
              <div className="pscore">{p.score}</div>
              {lastHere && <span key={lastHere.id} className={'delta' + (lastHere.ok ? '' : ' neg')}>{lastHere.ok ? '+' + (lastHere.score - (lastHere.bonus || 0)) + (lastHere.bonus ? ` +${lastHere.bonus}` : '') : lastHere.score}</span>}
            </div>
          );
        })}
      </section>

      <form className={'dock' + (myTurn ? ' on' : '') + (allowPrediction && !myTurn && (s.phase === 'turn' || s.phase === 'turnResult') ? ' predicting' : '')} onSubmit={submit}>
        <p className={'msg' + (msg ? ' show' : '')} key={shake} role="status">{msg || (myTurn ? ERR.chain(s) : allowPrediction && s.phase === 'turnResult' ? '다음 글자 공개 중! 지금 Enter를 누르세요.' : allowPrediction && s.phase === 'turn' ? '상대 차례예요. 단어를 미리 입력하고 글자가 공개될 때 Enter를 누르세요.' : ' ')}</p>
        <div className="row">
          <input
            ref={input} className="text big-input" value={text} onChange={(e) => { setText(e.target.value); if (!myTurn) setMsg(''); }}
            disabled={s.phase !== 'turn' && s.phase !== 'turnResult'} placeholder={myTurn ? '여기에 단어 입력' : allowPrediction ? '단어를 미리 입력' : s.phase === 'turn' ? `${s.players[curId]?.name} 차례…` : '잠시만요…'}
            autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="send" lang={mode.lang}
            aria-label={myTurn ? '단어 입력' : '예측 단어 입력'}
            onPaste={(e) => e.preventDefault()} onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}
          />
          <button className="send" type="submit" disabled={(s.phase !== 'turn' && s.phase !== 'turnResult') || !text.trim() || (!myTurn && s.phase !== 'turnResult')}>{myTurn ? '입력' : allowPrediction && s.phase === 'turnResult' ? '예측 발사' : '대기'}</button>
        </div>
        {allowPrediction && !myTurn && s.phase === 'turn' && text.trim() && <p className="prediction-note">🔒 단어는 나에게만 보여요 · 다음 글자 공개 때 Enter</p>}
        {allowPrediction && pendingPrediction && <p className="prediction-note">⚡ 예측 확정: {pendingPrediction} · 내 차례를 기다리는 중</p>}
        {activeOpts.length > 0 && <p className="rules">{activeOpts.join(' · ')}</p>}
      </form>
    </main>
  );
}

const hue = (id) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

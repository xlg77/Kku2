// 이메일 없는 자체 계정: 아이디+비밀번호 → DB 함수(kk_signup/kk_login)가 세션 토큰을 발급한다.
// 비밀번호는 DB 안에서 bcrypt 로만 저장·검증되고, 토큰은 해시로만 저장된다.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { load, save } from './storage.js';

export const ID_RE = /^[a-z0-9_]{3,16}$/;
export const MIN_PW = 8;

export const getToken = () => load('token', null);
const setToken = (t) => save('token', t);

const ERRORS = {
  bad_credentials: '아이디 또는 비밀번호가 틀렸어요',
  username_taken: '이미 사용 중인 아이디예요',
  too_many: '시도가 너무 많아요. 잠시 후 다시 해주세요',
  bad_input: '입력값을 확인해주세요',
  unauthorized: '로그인이 만료됐어요. 다시 로그인해주세요',
  forbidden: '관리자만 할 수 있어요',
};
const msg = (e) => ERRORS[e] || '오류: ' + e;

/** RPC 호출 → {data} 또는 {error: 한국어 메시지} */
async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: '서버 오류: ' + error.message };
  if (data && data.error) return { error: msg(data.error), code: data.error };
  return { data };
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const apply = useCallback((d) => {
    setUser(d ? { id: d.profile.id } : null);
    setProfile(d ? d.profile : null);
    setIsAdmin(!!(d && d.is_admin));
  }, []);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) { apply(null); return; }
    const r = await rpc('kk_me', { p_token: token });
    if (r.error) {
      if (r.code === 'unauthorized') { setToken(null); apply(null); } else setError(r.error);
      return;
    }
    setError(''); apply(r.data);
  }, [apply]);

  useEffect(() => { refresh().finally(() => setReady(true)); }, [refresh]);

  const finish = (r) => {
    if (r.error) return r.error;
    setToken(r.data.token); setError(''); apply(r.data);
    return null;
  };
  const signUp = async (username, password, nickname) => finish(await rpc('kk_signup', { p_username: username, p_password: password, p_nickname: nickname }));
  const signIn = async (username, password) => finish(await rpc('kk_login', { p_username: username, p_password: password }));
  const signOut = async () => {
    const t = getToken();
    setToken(null); apply(null);
    if (t) await supabase.rpc('kk_logout', { p_token: t });
  };
  const rename = async (nickname) => {
    const r = await rpc('kk_rename', { p_token: getToken(), p_nickname: nickname });
    if (r.error) setError(r.error); else refresh();
  };
  return { user, profile, ready, isAdmin, error, signUp, signIn, signOut, rename, refresh };
}

export async function recordGame({ mode, score, rank, players }) {
  const r = await rpc('kk_record_game', { p_token: getToken(), p_mode: mode, p_score: Math.round(score), p_rank: rank, p_players: players });
  return r.error || null;
}

export async function fetchLeaderboard(limit = 10) {
  const { data, error } = await supabase.from('profiles').select('id,nickname,games,wins,total_score,best_score')
    .gt('games', 0).order('total_score', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

const PAGE = 1000;
/** 관리자가 올린 추가 단어 전체 (PostgREST 기본 1000행 제한 때문에 페이지로 나눠 읽는다) */
export async function fetchCustomWords(lang) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('custom_words').select('word,loanword,injeong,strict')
      .eq('lang', lang).order('word').range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}
export async function countCustomWords() {
  const { data, error } = await supabase.rpc('kk_dict_info');
  if (error || !data) throw error || new Error('no info');
  return Object.values(data).reduce((n, x) => n + x.count, 0);
}
export async function uploadCustomWords(rows, onProgress) {
  const CH = 1000;
  for (let i = 0; i < rows.length; i += CH) {
    const r = await rpc('kk_admin_add_words', { p_token: getToken(), p_rows: rows.slice(i, i + CH) });
    if (r.error) return r.error;
    onProgress && onProgress(Math.min(rows.length, i + CH));
  }
  return null;
}
export async function deleteCustomWord(word) {
  const r = await rpc('kk_admin_delete_word', { p_token: getToken(), p_word: word });
  if (r.error) return r.error;
  return r.data.count ? null : '그런 추가 단어가 없어요';
}

/** 사전 파일 통째로 올리기: 줄 단위로 나눠(요청 하나가 3초 안에 끝나도록) 보낸다. format: 'dict'(기본 사전 형식) | 'plain'(한 줄에 단어 하나) */
export async function putDictFile(lang, text, format, replace, onProgress) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const valid = (line) => {
    if (format === 'plain') return lang === 'ko' ? /^[가-힣]{2,}$/.test(line) : /^[a-z]{2,}$/.test(line);
    return lang === 'ko' ? /^[가-힣]{2,}[0-9A-Za-z+\-][01][0-9]$/.test(line) : /^[a-z]{2,}[0-9]$/.test(line);
  };
  const validCount = lines.filter(valid).length;
  if (!validCount) return '이 파일에서 등록 가능한 단어를 찾지 못했어요. 언어와 파일 형식을 확인해주세요. 기존 사전은 변경하지 않았어요.';
  const STEP = 12000;
  let inserted = 0;
  for (let i = 0; i < lines.length; i += STEP) {
    const chunk = lines.slice(i, i + STEP);
    if (!chunk.some(valid)) continue;
    const r = await rpc('kk_admin_put_words', { p_token: getToken(), p_lang: lang, p_lines: chunk.join('\n'), p_format: format, p_replace: replace && i === 0 });
    if (r.error) return r.error;
    inserted += Number(r.data?.count || 0);
    onProgress && onProgress(Math.min(i + STEP, lines.length), lines.length);
  }
  if (!inserted) return '서버에 등록된 단어가 0개예요. 파일 형식을 확인해주세요.';
  return { count: inserted, valid: validCount, total: lines.length };
}

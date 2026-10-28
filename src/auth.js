import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// Supabase Auth 는 이메일이 필요하므로 아이디를 가짜 이메일로 바꿔 쓴다. (메일은 발송되지 않음 — 대시보드에서 "Confirm email" 을 꺼야 함)
export const EMAIL_DOMAIN = 'users.noreply.github.com';
export const ID_RE = /^[a-z0-9_]{3,16}$/;
export const MIN_PW = 6;
const toEmail = (id) => `kkutu_${id}@${EMAIL_DOMAIN}`;
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 12);

async function ensureProfile(user) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const m = user.user_metadata || {};
  const nickname = clean(m.nickname || (user.email || '').replace(/^kkutu_/, '').split('@')[0]) || '플레이어';
  const { error: e2 } = await supabase.from('profiles').insert({ id: user.id, nickname });
  if (e2 && e2.code !== '23505') throw e2; // 23505: 동시에 만들어진 경우
  const r = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (r.error) throw r.error;
  return r.data;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (u) => {
    if (!u) { setProfile(null); return; }
    try { setProfile(await ensureProfile(u)); setError(''); } catch (e) { setError('프로필을 불러오지 못했어요: ' + (e.message || e)); }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data.session?.user ?? null;
      setUser(u); setReady(true); refresh(u);
    }).catch(() => setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      const u = session?.user ?? null;
      setUser(u);
      // onAuthStateChange 콜백 안에서 바로 supabase 호출을 await 하면 교착될 수 있어 한 틱 미룬다
      setTimeout(() => refresh(u), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [refresh]);

  const signUp = async (id, password, nickname) => {
    const { data, error: e } = await supabase.auth.signUp({ email: toEmail(id), password, options: { data: { nickname: clean(nickname) || id } } });
    if (e) return friendly(e);
    if (!data.session) return '가입은 됐지만 로그인되지 않았어요. 관리자 설정(이메일 확인)을 확인해주세요.';
    return null;
  };
  const signIn = async (id, password) => {
    const { error: e } = await supabase.auth.signInWithPassword({ email: toEmail(id), password });
    return e ? friendly(e) : null;
  };
  const signOut = () => supabase.auth.signOut();
  const rename = async (nick) => {
    const nickname = clean(nick);
    if (!nickname || !user) return;
    const { error: e } = await supabase.from('profiles').update({ nickname }).eq('id', user.id);
    if (e) setError(e.message); else refresh(user);
  };
  return { user, profile, ready, error, signUp, signIn, signOut, rename, refresh: () => refresh(user) };
}

export async function recordGame({ mode, score, rank, players }) {
  const { error } = await supabase.rpc('record_game', { p_mode: mode, p_score: Math.round(score), p_rank: rank, p_players: players });
  return error ? error.message : null;
}

export async function fetchLeaderboard(limit = 10) {
  const { data, error } = await supabase.from('profiles').select('id,nickname,games,wins,total_score,best_score')
    .gt('games', 0).order('total_score', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

function friendly(e) {
  const m = (e.message || '').toLowerCase();
  if (m.includes('invalid login')) return '아이디 또는 비밀번호가 틀렸어요';
  if (m.includes('already')) return '이미 사용 중인 아이디예요';
  if (m.includes('password') && (m.includes('least') || m.includes('weak') || m.includes('short'))) return '비밀번호가 너무 짧거나 약해요';
  if (m.includes('rate') || e.status === 429) return '요청이 너무 많아요. 잠시 후 다시 시도해주세요';
  return '오류: ' + (e.message || e);
}

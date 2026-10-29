import { createClient } from '@supabase/supabase-js';

// 공개 키(publishable)는 브라우저에 노출되도록 설계된 키입니다. 권한은 DB 의 RLS/함수 검증이 결정합니다.
// 계정은 Supabase Auth 를 쓰지 않고 DB 의 자체 계정 함수(kk_*)로 처리하므로 auth 기능은 모두 끕니다.
export const SUPABASE_URL = 'https://bwekwqqeedpwefesjvlu.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_QnCSuA0LdVhUzIsO86Cogg_DBEXNbiv';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

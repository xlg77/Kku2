import { createClient } from '@supabase/supabase-js';

// 공개 키(publishable)는 브라우저에 노출되도록 설계된 키입니다. 권한은 DB 의 RLS/권한 설정이 결정합니다.
export const SUPABASE_URL = 'https://bwekwqqeedpwefesjvlu.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_QnCSuA0LdVhUzIsO86Cogg_DBEXNbiv';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

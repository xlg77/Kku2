-- 단어 추가/사전 올리기: 이미 있는 단어와 같은 묶음 안의 중복 단어는 오류 없이 덮어쓴다.
-- 같은 단어가 여러 번 들어오면 마지막 줄이 이긴다. (기존 hit 값은 건드리지 않는다)

create or replace function public.kk_admin_add_words(p_token text, p_rows jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v uuid := kkutu_private.session_account(p_token); n integer;
begin
  if v is null or not exists (select 1 from kkutu_private.accounts a where a.id = v and a.is_admin) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    return jsonb_build_object('error', 'bad_input');
  end if;
  with src as (
    select distinct on (x.word) x.word, x.lang,
      coalesce(x.loanword, false) as loanword, coalesce(x.injeong, false) as injeong, coalesce(x.strict, true) as strict
    from rows from (jsonb_to_recordset(p_rows) as (word text, lang text, loanword boolean, injeong boolean, strict boolean))
      with ordinality as x(word, lang, loanword, injeong, strict, ord)
    where (x.lang = 'ko' and x.word ~ '^[가-힣]{2,}$') or (x.lang = 'en' and x.word ~ '^[a-z]{2,}$')
    order by x.word, x.ord desc
  ), up_custom as (
    insert into public.custom_words (word, lang, loanword, injeong, strict)
    select s.word, s.lang, s.loanword, s.injeong, s.strict from src s
    on conflict (word) do update
      set lang = excluded.lang, loanword = excluded.loanword, injeong = excluded.injeong, strict = excluded.strict
    returning 1
  ), up_words as (
    insert into kkutu_private.words (lang, word, flag, strict, hit)
    select s.lang, s.word, (case when s.loanword then 1 else 0 end) | (case when s.injeong then 2 else 0 end), s.strict, 3 from src s
    on conflict (lang, word) do update set flag = excluded.flag, strict = excluded.strict
    returning 1
  )
  select count(*) into n from up_custom;
  return jsonb_build_object('ok', true, 'count', n);
end $function$;

create or replace function public.kk_admin_put_words(p_token text, p_lang text, p_lines text, p_format text, p_replace boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v uuid := kkutu_private.session_account(p_token); n int := 0; del int := 0;
  b text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-';
begin
  if v is null or not exists (select 1 from kkutu_private.accounts a where a.id = v and a.is_admin) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_lang not in ('ko','en') or p_format not in ('dict','plain') or length(coalesce(p_lines, '')) > 1500000 then
    return jsonb_build_object('error', 'bad_input');
  end if;
  if p_replace then delete from kkutu_private.words where lang = p_lang; get diagnostics del = row_count; end if;
  with src as (
    select trim(t.x) as l, t.ord from regexp_split_to_table(p_lines, E'\\r?\\n') with ordinality as t(x, ord)
  ), parsed as (
    select case when p_format = 'plain' then l when p_lang = 'ko' then left(l, -3) else left(l, -1) end as word,
      case when p_format = 'dict' and p_lang = 'ko' then position(substr(l, length(l) - 2, 1) in b) - 1 else 0 end as flag,
      case when p_format = 'dict' and p_lang = 'ko' then substr(l, length(l) - 1, 1) = '1' else true end as strict,
      case when p_format = 'dict' then right(l, 1)::smallint else 3::smallint end as hit,
      ord
    from src where l <> '' and (p_format = 'plain' or (l ~ '^.+[0-9]$' and length(l) > 2))
  ), ins as (
    insert into kkutu_private.words (lang, word, flag, strict, hit)
    select distinct on (word) p_lang, word, flag::smallint, strict, hit from parsed
    where (p_lang = 'ko' and word ~ '^[가-힣]{2,}$') or (p_lang = 'en' and word ~ '^[a-z]{2,}$')
    order by word, ord desc
    on conflict (lang, word) do update set flag = excluded.flag, strict = excluded.strict, hit = excluded.hit
    returning 1
  ) select count(*) into n from ins;
  return jsonb_build_object('ok', true, 'count', n, 'deleted', del);
end $function$;

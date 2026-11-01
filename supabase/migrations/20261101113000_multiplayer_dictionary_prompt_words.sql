create or replace function kkutu_private.make_title(p_mode text, p_rounds integer, p_opts jsonb)
returns text[]
language plpgsql
set search_path to ''
as $function$
declare
  lg text := kkutu_private.mode_lang(p_mode);
  chosen text;
  wl integer := case when p_mode = 'KKT' then 3 else 0 end;
begin
  if p_rounds is null or p_rounds < 1 or p_rounds > 10 then
    raise exception '라운드 설정이 올바르지 않습니다.';
  end if;

  select w.word
    into chosen
    from kkutu_private.words w
   where w.lang = lg
     and char_length(w.word) = p_rounds
     and kkutu_private.entry_denied(lg, w.flag, w.strict, p_opts) = 0
     and not exists (
       select 1
         from generate_series(1, char_length(w.word)) as pos(i)
        where not kkutu_private.has_next(p_mode, substr(w.word, pos.i, 1), p_opts, '{}'::text[], wl)
     )
   order by random()
   limit 1;

  if chosen is null then
    raise exception '현재 사전에서 %글자 제시어를 찾지 못했습니다. 라운드 수나 규칙 설정을 바꿔주세요.', p_rounds;
  end if;

  return array(
    select substr(chosen, i, 1)
      from generate_series(1, char_length(chosen)) as pos(i)
     order by i
  );
end
$function$;
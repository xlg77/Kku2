create or replace function kkutu_private.make_title(p_mode text, p_rounds integer, p_opts jsonb)
returns text[]
language plpgsql
stable
set search_path to ''
as $function$
declare
  lg text := kkutu_private.mode_lang(p_mode);
  res text[] := '{}';
  chosen text;
  i integer;
  ch text;
  valid_word boolean;
  wl integer := case when p_mode = 'KKT' then 3 else 0 end;
begin
  if p_rounds is null or p_rounds < 1 or p_rounds > 10 then
    raise exception '라운드 설정이 올바르지 않습니다.';
  end if;

  for candidate in
    select w.word
      from kkutu_private.words w
     where w.lang = lg
       and char_length(w.word) = p_rounds
       and kkutu_private.entry_denied(lg, w.flag, w.strict, p_opts) = 0
     order by random()
  loop
    valid_word := true;
    for i in 1..char_length(candidate.word) loop
      ch := substr(candidate.word, i, 1);
      if not kkutu_private.has_next(p_mode, ch, p_opts, '{}'::text[], wl) then
        valid_word := false;
        exit;
      end if;
    end loop;
    if valid_word then
      chosen := candidate.word;
      exit;
    end if;
  end loop;

  if chosen is null then
    raise exception '현재 사전에서 %글자 제시어를 찾지 못했습니다. 라운드 수나 규칙 설정을 바꿔주세요.', p_rounds;
  end if;

  return array(
    select substr(chosen, pos.i, 1)
      from generate_series(1, char_length(chosen)) as pos(i)
     order by pos.i
  );
end
$function$;
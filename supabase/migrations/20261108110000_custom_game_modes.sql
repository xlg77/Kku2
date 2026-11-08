-- User-created game modes with isolated dictionaries.
create table if not exists public.custom_modes (
  id text primary key,
  name text not null check (char_length(name) between 1 and 24),
  description text not null default '' check (char_length(description) <= 120),
  base_mode text not null check (base_mode in ('KSH','KKT','KAP','ESH','EKT')),
  lang text not null check (lang in ('ko','en')),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists kkutu_private.custom_mode_words (
  mode_id text not null references public.custom_modes(id) on delete cascade,
  word text not null,
  flag smallint not null default 0,
  strict boolean not null default true,
  hit smallint not null default 3,
  first1 text generated always as (left(word,1)) stored,
  last1 text generated always as (right(word,1)) stored,
  primary key(mode_id,word)
);
create index if not exists custom_mode_words_first_idx on kkutu_private.custom_mode_words(mode_id,first1);
create index if not exists custom_mode_words_last_idx on kkutu_private.custom_mode_words(mode_id,last1);
alter table public.custom_modes enable row level security;
alter table kkutu_private.custom_mode_words enable row level security;

create or replace function kkutu_private.mode_base(m text)
returns text language sql stable set search_path to ''
as $$ select coalesce((select cm.base_mode from public.custom_modes cm where cm.id=m),case when m in ('KSH','KKT','KAP','ESH','EKT') then m else 'KSH' end) $$;

create or replace function kkutu_private.mode_lang(m text)
returns text language sql stable set search_path to ''
as $$ select coalesce((select cm.lang from public.custom_modes cm where cm.id=m),case when m in ('ESH','EKT') then 'en' else 'ko' end) $$;

create or replace function kkutu_private.get_char(m text,t text)
returns text language sql stable set search_path to ''
as $$ select case kkutu_private.mode_base(m) when 'EKT' then right(t,3) when 'KAP' then left(t,1) else right(t,1) end $$;

create or replace function kkutu_private.get_sub(m text,c text)
returns text language sql stable set search_path to ''
as $$ select case when kkutu_private.mode_base(m)='EKT' then (case when length(c)>2 then substr(c,2) end) when kkutu_private.mode_base(m) in ('KSH','KKT','KAP') then kkutu_private.sub_char(c) end $$;

create or replace function kkutu_private.chainable(m text,t text,c text,s text,wl integer)
returns boolean language plpgsql stable set search_path to ''
as $$
declare b text:=kkutu_private.mode_base(m); l int:=length(c);
begin
 if t is null or length(t)<=l then return false; end if;
 if wl>0 and length(t)<>wl then return false; end if;
 if b='KAP' then return right(t,1)=c or (s is not null and right(t,1)=s); end if;
 if l=1 then return left(t,1)=c or (s is not null and left(t,1)=s);
 elsif l=2 then return left(t,2)=c;
 elsif l=3 then return left(t,3)=c or left(t,2)=substr(c,2); end if;
 return false;
end $$;

create or replace function kkutu_private.norm_settings(s jsonb)
returns jsonb language plpgsql stable set search_path to ''
as $$
declare m text:=coalesce(s->>'mode','KSH'); o jsonb:=coalesce(s->'opts','{}'); lg text; t int;
begin
 if m not in ('KSH','KKT','KAP','ESH','EKT') and not exists(select 1 from public.custom_modes cm where cm.id=m and cm.is_public) then m:='KSH'; end if;
 lg:=kkutu_private.mode_lang(m); t:=coalesce((s->>'time')::int,60);
 if t not in (30,60,90,120,150) then t:=60; end if;
 return jsonb_build_object('mode',m,'rounds',greatest(1,least(10,coalesce((s->>'rounds')::int,3))),
 'time',t,'bots',greatest(0,least(7,coalesce((s->>'bots')::int,0))),
 'level',greatest(0,least(4,coalesce((s->>'level')::int,2))),
 'opts',jsonb_build_object('manner',coalesce((o->>'manner')::boolean,false),'mission',coalesce((o->>'mission')::boolean,false),
 'injeong',lg='ko' and coalesce((o->>'injeong')::boolean,false),'loanword',lg='ko' and coalesce((o->>'loanword')::boolean,false),
 'strict',lg='ko' and coalesce((o->>'strict')::boolean,false)));
end $$;

create or replace function kkutu_private.cands(p_mode text,p_char text,p_opts jsonb,p_used text[],p_wl integer,p_lim integer,p_random boolean)
returns table(word text,hit smallint) language plpgsql stable set search_path to ''
as $$
declare lg text:=kkutu_private.mode_lang(p_mode); b text:=kkutu_private.mode_base(p_mode); sub text:=kkutu_private.get_sub(p_mode,p_char); chars text[];
begin
 if p_mode like 'CM%' then
  if b='KAP' then chars:=array_remove(array[p_char,sub],null);
  elsif b='EKT' and length(p_char)=3 then chars:=array[substr(p_char,1,1),substr(p_char,2,1)];
  else chars:=array_remove(array[p_char,sub],null); end if;
  if p_random then
   return query select w.word,w.hit from kkutu_private.custom_mode_words w where w.mode_id=p_mode
    and (case when b='KAP' then w.last1=any(chars) else w.first1=any(chars) end)
    and kkutu_private.chainable(b,w.word,p_char,sub,p_wl)
    and kkutu_private.entry_denied(lg,w.flag,w.strict,p_opts)=0
    and not (w.word=any(coalesce(p_used,'{}'::text[]))) order by random() limit p_lim;
  else
   return query select w.word,w.hit from kkutu_private.custom_mode_words w where w.mode_id=p_mode
    and (case when b='KAP' then w.last1=any(chars) else w.first1=any(chars) end)
    and kkutu_private.chainable(b,w.word,p_char,sub,p_wl)
    and kkutu_private.entry_denied(lg,w.flag,w.strict,p_opts)=0
    and not (w.word=any(coalesce(p_used,'{}'::text[]))) limit p_lim;
  end if;
  return;
 end if;
 if b='KAP' then chars:=array_remove(array[p_char,sub],null);
 elsif b='EKT' and length(p_char)=3 then chars:=array[substr(p_char,1,1),substr(p_char,2,1)];
 elsif b='EKT' then chars:=array[p_char];
 else chars:=array_remove(array[p_char,sub],null); end if;
 if p_random then
  return query select w.word,w.hit from kkutu_private.words w where w.lang=lg
   and (case when b='KAP' then w.last1=any(chars) else w.first1=any(chars) end)
   and kkutu_private.chainable(b,w.word,p_char,sub,p_wl)
   and kkutu_private.entry_denied(lg,w.flag,w.strict,p_opts)=0
   and not (w.word=any(coalesce(p_used,'{}'::text[]))) order by random() limit p_lim;
 else
  return query select w.word,w.hit from kkutu_private.words w where w.lang=lg
   and (case when b='KAP' then w.last1=any(chars) else w.first1=any(chars) end)
   and kkutu_private.chainable(b,w.word,p_char,sub,p_wl)
   and kkutu_private.entry_denied(lg,w.flag,w.strict,p_opts)=0
   and not (w.word=any(coalesce(p_used,'{}'::text[]))) limit p_lim;
 end if;
end $$;

create or replace function kkutu_private.do_submit(p_code text,p_pid text,p_text text,p_now bigint)
returns jsonb language plpgsql set search_path to ''
as $$
declare r public.rooms; pr kkutu_private.room_priv; st jsonb; opts jsonb; mode text; b text; lg text; cur text; txt text;
 ch text; sb text; wl int; used text[]; w record; den int; nc text; t bigint; tt int; tr numeric; sc numeric;
 n int; m text; cnt int; bonus int:=0; newm text; ev int; fin int; pl jsonb;
begin
 select * into r from public.rooms where code=p_code; select * into pr from kkutu_private.room_priv where code=p_code; st:=r.state;
 if st is null or st->>'phase'<>'turn' then return jsonb_build_object('ok',false,'code','phase'); end if;
 cur:=st->'seq'->>((st->>'turn')::int); if cur<>p_pid then return jsonb_build_object('ok',false,'code','turn'); end if;
 opts:=st->'opts'; mode:=st->>'mode'; b:=kkutu_private.mode_base(mode); lg:=kkutu_private.mode_lang(mode);
 txt:=trim(coalesce(p_text,'')); if lg='en' then txt:=lower(txt); end if;
 if txt='' then return jsonb_build_object('ok',false,'code','empty'); end if;
 ch:=st->>'char'; sb:=st->>'subChar'; wl:=case when b='KKT' then 3 else 0 end;
 if not kkutu_private.chainable(b,txt,ch,sb,wl) then return jsonb_build_object('ok',false,'code','chain'); end if;
 used:=array(select jsonb_array_elements_text(st->'chain')); if txt=any(used) then return jsonb_build_object('ok',false,'code','409'); end if;
 if mode like 'CM%' then
  select ww.flag,ww.strict as is_strict into w from kkutu_private.custom_mode_words ww where ww.mode_id=mode and ww.word=txt;
 else
  select ww.flag,ww.strict as is_strict into w from kkutu_private.words ww where ww.lang=lg and ww.word=txt;
 end if;
 if not found then return jsonb_build_object('ok',false,'code','404'); end if;
 den:=kkutu_private.entry_denied(lg,w.flag,w.is_strict,opts); if den>0 then return jsonb_build_object('ok',false,'code',den::text); end if;
 nc:=kkutu_private.get_char(b,txt);
 if cardinality(used)=0 or coalesce((opts->>'manner')::boolean,false) then
  if not kkutu_private.has_next(mode,nc,opts,used||txt,wl) then return jsonb_build_object('ok',false,'code',case when cardinality(used)=0 then '402' else '403' end); end if;
 end if;
 t:=greatest(0,p_now-(st->>'turnAt')::bigint); tt:=(st->>'turnTime')::int; tr:=1-t::numeric/tt;
 sc:=kkutu_private.pre_score(length(txt),cardinality(used),tr); n:=coalesce((pr.dic->>txt)::int,0); if n>0 then sc:=sc*15/(n+15); end if;
 m:=st->>'mission'; newm:=m;
 if m is not null and m<>'' and coalesce((opts->>'mission')::boolean,false) then
  cnt:=(length(txt)-length(replace(txt,m,'')))/length(m);
  if cnt>0 then bonus:=round(sc*0.5*cnt)::int; sc:=sc+sc*0.5*cnt; newm:=kkutu_private.mk_mission(lg); end if;
 end if;
 fin:=round(sc)::int; pl:=st->'players'->cur; ev:=coalesce((st->>'ev')::int,0)+1;
 st:=jsonb_set(st,array['players',cur,'score'],to_jsonb((pl->>'score')::int+fin));
 st:=jsonb_set(st,array['players',cur,'words'],to_jsonb((pl->>'words')::int+1));
 if length(txt)>length(pl->>'best') then st:=jsonb_set(st,array['players',cur,'best'],to_jsonb(txt)); end if;
 st:=st||jsonb_build_object('phase','turnResult','chain',(st->'chain')||to_jsonb(txt),'char',nc,
  'subChar',kkutu_private.get_sub(mode,nc),'mission',newm,'ev',ev,'last',jsonb_build_object('id',ev,'pid',cur,'ok',true,'score',fin,'bonus',bonus,'word',txt));
 update public.rooms set state=st,version=version+1,updated_at=now() where code=p_code;
 update kkutu_private.room_priv set dic=jsonb_set(pr.dic,array[txt],to_jsonb(n+1)),round_time=pr.round_time-t::int,
  deadline=p_now+1250,nxt='nextTurn',bot_word=null,bot_due=null where code=p_code;
 return jsonb_build_object('ok',true);
end $$;

create or replace function kkutu_private.make_title(p_mode text,p_rounds integer,p_opts jsonb)
returns text[] language plpgsql stable set search_path to ''
as $$
declare lg text:=kkutu_private.mode_lang(p_mode); candidate record; chosen text; i int; valid_word boolean; ch text;
 wl int:=case when kkutu_private.mode_base(p_mode)='KKT' then 3 else 0 end;
begin
 if p_rounds is null or p_rounds<1 or p_rounds>10 then raise exception '라운드 설정이 올바르지 않습니다.'; end if;
 if p_mode like 'CM%' then
  if p_rounds=1 then
   for candidate in select distinct left(w.word,1) as word from kkutu_private.custom_mode_words w
    where w.mode_id=p_mode and kkutu_private.entry_denied(lg,w.flag,w.strict,p_opts)=0 order by word limit 500 loop
    if kkutu_private.has_next(p_mode,candidate.word,p_opts,'{}'::text[],wl) then chosen:=candidate.word; exit; end if;
   end loop;
  else
   for candidate in select w.word from kkutu_private.custom_mode_words w where w.mode_id=p_mode and char_length(w.word)=p_rounds
    and kkutu_private.entry_denied(lg,w.flag,w.strict,p_opts)=0 order by random() limit 500 loop
    valid_word:=true;
    for i in 1..char_length(candidate.word) loop ch:=substr(candidate.word,i,1); if not kkutu_private.has_next(p_mode,ch,p_opts,'{}'::text[],wl) then valid_word:=false; exit; end if; end loop;
    if valid_word then chosen:=candidate.word; exit; end if;
   end loop;
  end if;
 else
  if p_rounds=1 then
   for candidate in select distinct left(w.word,1) as word from kkutu_private.words w
    where w.lang=lg and kkutu_private.entry_denied(lg,w.flag,w.strict,p_opts)=0 order by word limit 500 loop
    if kkutu_private.has_next(p_mode,candidate.word,p_opts,'{}'::text[],wl) then chosen:=candidate.word; exit; end if;
   end loop;
  else
   for candidate in select w.word from kkutu_private.words w where w.lang=lg and char_length(w.word)=p_rounds
    and kkutu_private.entry_denied(lg,w.flag,w.strict,p_opts)=0 order by random() limit 500 loop
    valid_word:=true;
    for i in 1..char_length(candidate.word) loop ch:=substr(candidate.word,i,1); if not kkutu_private.has_next(p_mode,ch,p_opts,'{}'::text[],wl) then valid_word:=false; exit; end if; end loop;
    if valid_word then chosen:=candidate.word; exit; end if;
   end loop;
  end if;
 end if;
 if chosen is null then raise exception '현재 사전에서 %글자 제시어를 찾지 못했습니다. 라운드 수나 규칙 설정을 바꿔주세요.',p_rounds; end if;
 return array(select substr(chosen,pos.i,1) from generate_series(1,char_length(chosen)) as pos(i) order by pos.i);
end $$;

create or replace function public.kk_modes_list()
returns jsonb language sql stable security definer set search_path to ''
as $$ select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'base_mode',base_mode,'lang',lang) order by created_at desc),'[]'::jsonb) from public.custom_modes where is_public $$;

create or replace function public.kk_admin_mode_save(p_token text,p_id text,p_name text,p_description text,p_base_mode text,p_is_public boolean)
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v uuid:=kkutu_private.session_account(p_token); mid text:=coalesce(nullif(p_id,''),'CM'||substr(replace(gen_random_uuid()::text,'-',''),1,12)); lg text; old_lang text;
begin
 if v is null or not exists(select 1 from kkutu_private.accounts a where a.id=v and a.is_admin) then return jsonb_build_object('error','forbidden'); end if;
 if p_base_mode not in ('KSH','KKT','KAP','ESH','EKT') or char_length(trim(coalesce(p_name,''))) not between 1 and 24 or char_length(coalesce(p_description,''))>120 then return jsonb_build_object('error','bad_input'); end if;
 lg:=case when p_base_mode in ('ESH','EKT') then 'en' else 'ko' end;
 if p_id is null or p_id='' then
  insert into public.custom_modes(id,name,description,base_mode,lang,is_public) values(mid,trim(p_name),coalesce(p_description,''),p_base_mode,lg,coalesce(p_is_public,true));
 else
  select cm.lang into old_lang from public.custom_modes cm where cm.id=mid;
  if old_lang is null then return jsonb_build_object('error','not_found'); end if;
  if old_lang<>lg and exists(select 1 from kkutu_private.custom_mode_words w where w.mode_id=mid) then return jsonb_build_object('error','mode_language_locked'); end if;
  update public.custom_modes set name=trim(p_name),description=coalesce(p_description,''),base_mode=p_base_mode,lang=lg,is_public=coalesce(p_is_public,true),updated_at=now() where id=mid;
 end if;
 return jsonb_build_object('ok',true,'id',mid);
end $$;

create or replace function public.kk_admin_mode_words(p_token text,p_mode text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v uuid:=kkutu_private.session_account(p_token); lg text; n int;
begin
 if v is null or not exists(select 1 from kkutu_private.accounts a where a.id=v and a.is_admin) then return jsonb_build_object('error','forbidden'); end if;
 select lang into lg from public.custom_modes where id=p_mode; if lg is null then return jsonb_build_object('error','not_found'); end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>2000 then return jsonb_build_object('error','bad_input'); end if;
 with src as (
  select distinct on (x.word) x.word,
   (case when coalesce(x.loanword,false) then 1 else 0 end | case when coalesce(x.injeong,false) then 2 else 0 end)::smallint as flag,
   coalesce(x.strict,true) as strict
  from jsonb_to_recordset(p_rows) as x(word text,loanword boolean,injeong boolean,strict boolean)
  where (lg='ko' and x.word ~ '^[가-힣]{2,}$') or (lg='en' and x.word ~ '^[a-z]{2,}$') order by x.word
 ), ins as (
  insert into kkutu_private.custom_mode_words(mode_id,word,flag,strict,hit)
  select p_mode,word,flag,strict,3 from src on conflict(mode_id,word) do update set flag=excluded.flag,strict=excluded.strict returning 1
 ) select count(*) into n from ins;
 return jsonb_build_object('ok',true,'count',n);
end $$;

create or replace function public.kk_admin_modes_list(p_token text)
returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare v uuid:=kkutu_private.session_account(p_token);
begin
 if v is null or not exists(select 1 from kkutu_private.accounts a where a.id=v and a.is_admin) then return jsonb_build_object('error','forbidden'); end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',cm.id,'name',cm.name,'description',cm.description,'base_mode',cm.base_mode,'lang',cm.lang,'is_public',cm.is_public,
 'count',(select count(*) from kkutu_private.custom_mode_words w where w.mode_id=cm.id)) order by cm.created_at desc) from public.custom_modes cm),'[]'::jsonb);
end $$;

create or replace function public.kk_admin_mode_delete(p_token text,p_mode text)
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v uuid:=kkutu_private.session_account(p_token);
begin
 if v is null or not exists(select 1 from kkutu_private.accounts a where a.id=v and a.is_admin) then return jsonb_build_object('error','forbidden'); end if;
 delete from public.custom_modes where id=p_mode;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.kk_custom_dict_info(p_mode text)
returns jsonb language sql stable security definer set search_path to ''
as $$
 select jsonb_build_object('lang',cm.lang,'base_mode',cm.base_mode,'count',(select count(*) from kkutu_private.custom_mode_words w where w.mode_id=cm.id))
 from public.custom_modes cm where cm.id=p_mode and cm.is_public
$$;

create or replace function public.kk_custom_dict_chunk(p_mode text,p_after text default '',p_limit integer default 40000)
returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare b text:='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-'; r record; lg text;
begin
 if p_limit not between 1 and 60000 then return jsonb_build_object('error','bad_input'); end if;
 select lang into lg from public.custom_modes where id=p_mode and is_public; if lg is null then return jsonb_build_object('error','not_found'); end if;
 select string_agg(x.line,E'\n' order by x.word) as lines,max(x.word) as last,count(*) as n into r
 from (select w.word,case when lg='ko' then w.word||substr(b,w.flag+1,1)||(case when w.strict then '1' else '0' end)||w.hit::text else w.word||w.hit::text end as line
  from kkutu_private.custom_mode_words w where w.mode_id=p_mode and w.word>p_after order by w.word limit p_limit) x;
 return jsonb_build_object('lines',coalesce(r.lines,''),'last',coalesce(r.last,p_after),'done',r.n<p_limit);
end $$;

create or replace function public.kk_room_start(p_token text,p_code text)
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v uuid:=kkutu_private.session_account(p_token); r public.rooms; c text:=upper(trim(coalesce(p_code,'')));
 s jsonb; n_hum int; nb int; players jsonb:='{}'; seq text[]; e jsonb; i int; st jsonb;
 names text[]:=array['하늘','바다','구름','노을','별빛','은하','새벽','단풍']; b text; mn text;
begin
 if v is null then return jsonb_build_object('error','unauthorized'); end if;
 select * into r from public.rooms where code=c for update; if not found then return jsonb_build_object('error','not_found'); end if;
 if r.host_id<>v then return jsonb_build_object('error','forbidden'); end if; if r.status='playing' then return jsonb_build_object('error','in_game'); end if;
 s:=r.settings; n_hum:=jsonb_array_length(r.members); nb:=least((s->>'bots')::int,r.max_players-n_hum);
 if n_hum+nb<2 then return jsonb_build_object('error','need_players'); end if;
 for e in select * from jsonb_array_elements(r.members) loop
  players:=players||jsonb_build_object(e->>'id',jsonb_build_object('id',e->>'id','name',e->>'nickname','bot',false,'level',0,'score',0,'words',0,'best',''));
 end loop;
 for i in 1..nb loop players:=players||jsonb_build_object('bot'||i,jsonb_build_object('id','bot'||i,'name',names[i]||' (봇)','bot',true,'level',(s->>'level')::int,'score',0,'words',0,'best','')); end loop;
 seq:=array(select k from jsonb_object_keys(players) k order by random());
 b:=kkutu_private.mode_base(s->>'mode');
 mn:=coalesce((select cm.name from public.custom_modes cm where cm.id=s->>'mode'),
  case b when 'KSH' then '끝말잇기' when 'KKT' then '쿵쿵따' when 'KAP' then '앞말잇기' when 'ESH' then 'English 끝말잇기' else 'English 3글자' end);
 st:=jsonb_build_object('phase','roundReady','round',0,'rounds',(s->>'rounds')::int,'mode',s->>'mode','baseMode',b,'modeName',mn,'opts',s->'opts',
  'seq',to_jsonb(seq),'turn',0,'players',players,'char','','subChar',null,'chain','[]'::jsonb,'mission',null,'turnAt',0,'turnTime',0,
  'speed',0,'roundTimeLeft',0,'last',null,'hint',null,'ranking',null,'ev',0);
 update public.rooms set state=st,status='playing',version=version+1,updated_at=now() where code=c;
 update kkutu_private.room_priv rp set dic='{}',humans=n_hum,title=kkutu_private.make_title(s->>'mode',(s->>'rounds')::int,s->'opts'),
  seen=(select coalesce(jsonb_object_agg(e2->>'id',kkutu_private.now_ms()),'{}') from jsonb_array_elements(r.members) e2) where rp.code=c;
 perform kkutu_private.begin_round(c);
 return jsonb_build_object('ok',true,'room',kkutu_private.room_json(c));
end $$;

grant execute on function public.kk_modes_list() to anon,authenticated;
grant execute on function public.kk_custom_dict_info(text) to anon,authenticated;
grant execute on function public.kk_custom_dict_chunk(text,text,integer) to anon,authenticated;
grant execute on function public.kk_admin_mode_save(text,text,text,text,text,boolean) to anon,authenticated;
grant execute on function public.kk_admin_mode_words(text,text,jsonb) to anon,authenticated;
grant execute on function public.kk_admin_modes_list(text) to anon,authenticated;
grant execute on function public.kk_admin_mode_delete(text,text) to anon,authenticated;

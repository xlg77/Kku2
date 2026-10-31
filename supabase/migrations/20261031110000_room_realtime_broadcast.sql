-- Notify Kku2 clients about room changes without broadcasting private room state.
-- Clients receive only code/version/operation, then fetch authorized state through kk_room_tick.
create or replace function kkutu_private.broadcast_room_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_version bigint;
  v_op text := tg_op;
begin
  if tg_op = 'DELETE' then
    v_code := old.code;
    v_version := old.version;
  else
    v_code := new.code;
    v_version := new.version;
  end if;

  perform realtime.send(
    jsonb_build_object('code', v_code, 'version', v_version, 'operation', v_op),
    'room_changed',
    'kku2:lobby',
    false
  );

  perform realtime.send(
    jsonb_build_object('code', v_code, 'version', v_version, 'operation', v_op),
    'room_changed',
    'kku2:room:' || v_code,
    false
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function kkutu_private.broadcast_room_change() from public, anon, authenticated;

drop trigger if exists kku2_room_broadcast on public.rooms;
create trigger kku2_room_broadcast
after insert or update or delete on public.rooms
for each row execute function kkutu_private.broadcast_room_change();

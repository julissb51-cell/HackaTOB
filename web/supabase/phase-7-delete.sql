-- Fase 7: borrar salas. Solo quien la creó puede borrarla; las salas demo nunca.
-- members, events y room_analysis ya tienen ON DELETE CASCADE hacia rooms.

drop policy if exists rooms_delete_for_owner on public.rooms;
create policy rooms_delete_for_owner on public.rooms
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    and id not in ('demo', 'demo-final', 'demo-ensayo', 'prueba-f6')
  );

drop policy if exists members_delete_self on public.members;
create policy members_delete_self on public.members
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Red de seguridad: ni siquiera el service role puede borrar las salas demo.
create or replace function private.protect_demo_rooms() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.id in ('demo', 'demo-final', 'demo-ensayo', 'prueba-f6') then
    raise exception 'sala protegida: %', old.id using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists rooms_protect_demo on public.rooms;
create trigger rooms_protect_demo before delete on public.rooms
  for each row execute function private.protect_demo_rooms();

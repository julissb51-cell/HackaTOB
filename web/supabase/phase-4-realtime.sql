-- Fase 4. Pegar en el SQL Editor si el esquema ya estaba aplicado
-- antes de la vista en vivo. Se puede ejecutar más de una vez.
--
-- Mete events en la publicación supabase_realtime y deja que un miembro
-- autenticado lea los eventos de su sala. rooms y members quedan con la
-- misma lectura de la fase 3 (sin rooms.token). anon no lee nada.
-- La clave de servicio no pasa por estas políticas: la API la usa solo
-- en el servidor.

alter table public.events replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'events'
     ) then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;

alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;

revoke all on table public.rooms from anon, authenticated;
revoke all on table public.members from anon, authenticated;
revoke all on table public.events from anon, authenticated;

grant select, insert, update, delete on table public.rooms to service_role;
grant select, insert, update, delete on table public.members to service_role;
grant select, insert, update, delete on table public.events to service_role;

create schema if not exists private;

create or replace function private.can_read_room(target_room text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms as room
    where room.id = target_room
      and (
        room.created_by = (select auth.uid())
        or exists (
          select 1
          from public.members as member
          where member.room_id = room.id
            and member.user_id = (select auth.uid())
        )
      )
  );
$$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.can_read_room(text) from public, anon, authenticated;
grant execute on function private.can_read_room(text) to authenticated;

grant select (id, topic, project_name, due_date, created_by, parts, created_at)
  on table public.rooms to authenticated;
grant select (id, room_id, name, part, user_id, created_at)
  on table public.members to authenticated;
grant select on table public.events to authenticated;

drop policy if exists rooms_select_for_member on public.rooms;
create policy rooms_select_for_member
  on public.rooms
  for select
  to authenticated
  using (private.can_read_room(id));

drop policy if exists members_select_for_room on public.members;
create policy members_select_for_room
  on public.members
  for select
  to authenticated
  using (private.can_read_room(room_id));

drop policy if exists events_select_for_room on public.events;
create policy events_select_for_room
  on public.events
  for select
  to authenticated
  using (private.can_read_room(room_id));

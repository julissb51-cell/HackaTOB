-- Fase 3. Pegar en el SQL Editor después de schema.sql si las tablas
-- ya existían sin estas columnas. Se puede ejecutar más de una vez.
--
-- La fecha de entrega no se duplica: sigue en rooms.due_date
-- (AAAA-MM-DD, el texto "sin fecha", o vacío).
-- rooms.parts es la lista de tareas. rooms.created_by y members.user_id
-- apuntan a la cuenta de Google. El token sigue fuera de la Data API.

-- Postgres no acepta una subconsulta dentro de CHECK. La lista de partes
-- se valida en esta función y la restricción solo la llama.
-- El privilegio por defecto es de public; sin quitarlo, anon y authenticated
-- seguirían pudiendo ejecutarla. La API inserta con la clave de servicio.
create or replace function public.enlaza_parts_valid(parts jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(parts) is distinct from 'array' then false
    when jsonb_array_length(parts) > 30 then false
    else not exists (
      select 1
      from jsonb_array_elements(parts) as elem
      where jsonb_typeof(elem) <> 'string'
        or char_length(elem #>> '{}') < 1
        or char_length(elem #>> '{}') > 120
    )
  end;
$$;

revoke execute on function public.enlaza_parts_valid(jsonb) from public, anon, authenticated;
grant execute on function public.enlaza_parts_valid(jsonb) to service_role;

alter table public.rooms add column if not exists created_by uuid;
alter table public.rooms add column if not exists parts jsonb;

alter table public.rooms alter column parts set default '[]'::jsonb;
update public.rooms set parts = '[]'::jsonb where parts is null;
alter table public.rooms alter column parts set not null;

alter table public.members add column if not exists user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rooms_created_by_fkey'
  ) then
    alter table public.rooms
      add constraint rooms_created_by_fkey
      foreign key (created_by) references auth.users (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'members_user_id_fkey'
  ) then
    alter table public.members
      add constraint members_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rooms_parts_check'
  ) then
    alter table public.rooms
      add constraint rooms_parts_check check (public.enlaza_parts_valid(parts));
  end if;
end $$;

create index if not exists members_user_id_idx on public.members (user_id);
create unique index if not exists members_room_user_uidx
  on public.members (room_id, user_id)
  where user_id is not null;
create index if not exists rooms_created_by_idx on public.rooms (created_by);

alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;

revoke all on table public.rooms from anon, authenticated;
revoke all on table public.members from anon, authenticated;
revoke all on table public.events from anon, authenticated;

grant select, insert, update, delete on table public.rooms to service_role;
grant select, insert, update, delete on table public.members to service_role;
grant select, insert, update, delete on table public.events to service_role;

-- security definer vive en private, que no está expuesto en la Data API.
-- Así la política no se llama a sí misma al leer members y rooms.
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

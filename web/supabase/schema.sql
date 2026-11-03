-- Enlaza: salas, miembros y eventos.
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- La columna events.ai es la IA de la persona (chatgpt, gemini, cursor,
-- claude, copilot). El analista de la sala no se guarda aquí.
-- events.event_id es el id del contrato, por ejemplo evt_demo_001.
-- Si el envío falla, se reintenta con ese mismo id.

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

create table public.rooms (
  id text primary key,
  topic text not null,
  project_name text,
  due_date text,
  token text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint rooms_due_date_check check (
    due_date is null
    or due_date = 'sin fecha'
    or due_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ),
  constraint rooms_parts_check check (public.enlaza_parts_valid(parts))
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  part text,
  created_at timestamptz not null default now()
);

create table public.events (
  event_id text primary key,
  room_id text not null references public.rooms (id) on delete cascade,
  member text not null,
  ai text not null,
  type text not null,
  conversation_id text not null,
  conversation_name text,
  text text not null,
  created_at text not null,
  constraint events_ai_check check (
    ai in ('chatgpt', 'gemini', 'cursor', 'claude', 'copilot')
  ),
  constraint events_type_check check (
    type in ('prompt', 'respuesta', 'archivo')
  ),
  constraint events_text_len check (char_length(text) <= 100000),
  constraint events_created_at_local check (
    created_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
  )
);

create index members_room_id_idx on public.members (room_id);
create index members_user_id_idx on public.members (user_id);
create unique index members_room_user_uidx on public.members (room_id, user_id) where user_id is not null;
create index rooms_created_by_idx on public.rooms (created_by);
create index events_room_id_created_at_idx on public.events (room_id, created_at);

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

-- La clave anónima llega al navegador. Sin estas revocaciones, cualquiera
-- podría leer rooms.token por la Data API. La API de Enlaza usa la clave
-- de servicio, que no pasa por estas políticas, y revisa x-room-token.
alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;

revoke all on table public.rooms from anon, authenticated;
revoke all on table public.members from anon, authenticated;
revoke all on table public.events from anon, authenticated;

grant select, insert, update, delete on table public.rooms to service_role;
grant select, insert, update, delete on table public.members to service_role;
grant select, insert, update, delete on table public.events to service_role;

-- La fecha sigue en due_date. created_by y members.user_id identifican la
-- cuenta de Google. parts es la lista de tareas de la sala. El token no se
-- concede a authenticated: si no, la Data API lo devolvería.
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

-- events no guarda secretos. La política limita cada fila a la sala del
-- miembro. anon sigue sin permiso. La API escribe con la clave de servicio.
grant select on table public.events to authenticated;

drop policy if exists events_select_for_room on public.events;
create policy events_select_for_room
  on public.events
  for select
  to authenticated
  using (private.can_read_room(room_id));

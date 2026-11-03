-- Enlaza: salas, miembros y eventos.
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- La columna events.ai es la IA de la persona (chatgpt, gemini, cursor,
-- claude, copilot). El analista de la sala no se guarda aquí.

create table public.rooms (
  id text primary key,
  topic text not null,
  project_name text,
  due_date text,
  token text not null unique,
  created_at timestamptz not null default now(),
  constraint rooms_due_date_check check (
    due_date is null
    or due_date = 'sin fecha'
    or due_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  )
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  name text not null,
  part text,
  created_at timestamptz not null default now()
);

create table public.events (
  event_id uuid primary key default gen_random_uuid(),
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

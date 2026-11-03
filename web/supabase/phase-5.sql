-- Fase 5. Pegar en el SQL Editor si las tablas ya existían.
-- Se puede ejecutar más de una vez.
--
-- parts queda vacío por defecto y puede ser null (se lee como lista vacía).
-- due_date null significa que nadie eligió fecha. "sin fecha" sigue siendo
-- una elección explícita. language es el idioma del analista (es o en).
-- room_analysis guarda el resumen, los avisos, el contexto de cada miembro,
-- los nombres de chat y la sugerencia de partes o fecha.
-- El id de la sala se puede cambiar: las claves foráneas siguen el cambio.

-- El parámetro sigue llamándose p. CREATE OR REPLACE no puede renombrarlo
-- (42P13) si la función ya existe en la base.
create or replace function public.enlaza_parts_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then true
    when jsonb_typeof(p) is distinct from 'array' then false
    when jsonb_array_length(p) > 30 then false
    else not exists (
      select 1
      from jsonb_array_elements(p) as elem
      where jsonb_typeof(elem) <> 'string'
        or char_length(elem #>> '{}') < 1
        or char_length(elem #>> '{}') > 120
    )
  end;
$$;

revoke execute on function public.enlaza_parts_valid(jsonb) from public, anon, authenticated;
grant execute on function public.enlaza_parts_valid(jsonb) to service_role;

alter table public.rooms alter column parts drop not null;
alter table public.rooms alter column parts set default '[]'::jsonb;
alter table public.rooms alter column due_date drop not null;
alter table public.rooms alter column due_date set default null;

alter table public.rooms add column if not exists language text not null default 'es';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rooms_language_check'
  ) then
    alter table public.rooms
      add constraint rooms_language_check check (language in ('es', 'en'));
  end if;
end $$;

-- Quita la clave foránea hacia rooms y la vuelve a crear con ON UPDATE CASCADE.
do $$
declare
  target text;
  constraint_name text;
begin
  foreach target in array ARRAY['members', 'events', 'room_analysis']
  loop
    if to_regclass('public.' || target) is null then
      continue;
    end if;
    for constraint_name in
      select con.conname
      from pg_constraint as con
      join pg_class as rel on rel.oid = con.conrelid
      join pg_namespace as nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and rel.relname = target
        and con.contype = 'f'
        and pg_get_constraintdef(con.oid) ilike '%references%rooms%'
    loop
      execute format('alter table public.%I drop constraint %I', target, constraint_name);
    end loop;
  end loop;
end $$;

alter table public.members
  add constraint members_room_id_fkey
  foreign key (room_id) references public.rooms (id)
  on delete cascade on update cascade;

alter table public.events
  add constraint events_room_id_fkey
  foreign key (room_id) references public.rooms (id)
  on delete cascade on update cascade;

create table if not exists public.room_analysis (
  room_id text primary key,
  resumen text not null default '',
  miembros jsonb not null default '[]'::jsonb,
  alertas jsonb not null default '[]'::jsonb,
  chats jsonb not null default '[]'::jsonb,
  sugerencia jsonb,
  sugerencia_estado text not null default 'ninguna',
  fuente text not null default 'reglas',
  idioma text not null default 'es',
  eventos integer not null default 0,
  ran_at timestamptz not null default now(),
  pending boolean not null default false
);

alter table public.room_analysis
  add constraint room_analysis_room_id_fkey
  foreign key (room_id) references public.rooms (id)
  on delete cascade on update cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'room_analysis_estado_check'
  ) then
    alter table public.room_analysis
      add constraint room_analysis_estado_check check (
        sugerencia_estado in ('ninguna', 'pendiente', 'aceptada', 'descartada')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'room_analysis_fuente_check'
  ) then
    alter table public.room_analysis
      add constraint room_analysis_fuente_check check (fuente in ('ia', 'reglas'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'room_analysis_idioma_check'
  ) then
    alter table public.room_analysis
      add constraint room_analysis_idioma_check check (idioma in ('es', 'en'));
  end if;
end $$;

alter table public.room_analysis replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'room_analysis'
     ) then
    alter publication supabase_realtime add table public.room_analysis;
  end if;
end $$;

alter table public.room_analysis enable row level security;

revoke all on table public.room_analysis from anon, authenticated;
grant select, insert, update, delete on table public.room_analysis to service_role;
grant select on table public.room_analysis to authenticated;
grant select (language) on table public.rooms to authenticated;

drop policy if exists room_analysis_select_for_member on public.room_analysis;
create policy room_analysis_select_for_member
  on public.room_analysis
  for select
  to authenticated
  using (private.can_read_room(room_id));

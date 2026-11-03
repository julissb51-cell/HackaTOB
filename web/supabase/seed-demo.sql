-- Sala demo para probar los endpoints.
-- Id: demo
-- Token: token-de-prueba
--
-- Si events.event_id se creó como uuid, este script lo pasa a text
-- para aceptar ids como evt_demo_001. También cierra las tablas a la
-- clave anónima. Ejecutar en el SQL Editor después de schema.sql.

do $$
begin
  if to_regclass('public.events') is null or to_regclass('public.rooms') is null then
    raise exception 'Faltan las tablas. Ejecuta supabase/schema.sql primero.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'event_id'
      and udt_name = 'uuid'
  ) then
    alter table public.events alter column event_id drop default;
    alter table public.events alter column event_id type text using event_id::text;
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

insert into public.rooms (id, topic, project_name, due_date, token)
values (
  'demo',
  'App para repartir tareas de un trabajo',
  'Enlaza',
  '2026-11-06',
  'token-de-prueba'
)
on conflict (id) do update set
  topic = excluded.topic,
  project_name = excluded.project_name,
  due_date = excluded.due_date,
  token = excluded.token;

delete from public.members where room_id = 'demo';

insert into public.members (room_id, name, part)
values
  ('demo', 'Ana', 'Pantalla de la sala'),
  ('demo', 'Luis', 'Datos');

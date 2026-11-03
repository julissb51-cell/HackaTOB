-- Sala de ensayo: igual que demo-final, para probar sin ensuciar la sala de la presentación.
-- Id: demo-ensayo  Token: ensayo-hackatob
-- Ejecutar en el SQL Editor. Después: node scripts/seed-demo-ensayo.mjs

insert into public.rooms (id, topic, project_name, due_date, token, parts, language)
values (
  'demo-ensayo',
  'Proyecto de Programación: Sistema de gestión de biblioteca',
  'Sistema de biblioteca',
  '2026-11-06',
  'ensayo-hackatob',
  '["Informe escrito", "Código", "Presentación"]'::jsonb,
  'es'
)
on conflict (id) do update set
  topic = excluded.topic,
  project_name = excluded.project_name,
  due_date = excluded.due_date,
  token = excluded.token,
  parts = excluded.parts,
  language = excluded.language;

delete from public.events where room_id = 'demo-ensayo';
delete from public.room_analysis where room_id = 'demo-ensayo';
delete from public.members where room_id = 'demo-ensayo';

insert into public.members (room_id, name, part)
values
  ('demo-ensayo', 'Ana', 'Informe escrito'),
  ('demo-ensayo', 'Luis', 'Código'),
  ('demo-ensayo', 'Sofía', 'Presentación');

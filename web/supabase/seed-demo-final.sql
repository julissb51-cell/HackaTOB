-- Sala de demo final para la presentación del hackathon.
-- Id: demo-final  Token: demo-hackatob
-- Ejecutar en el SQL Editor. Después: node scripts/seed-demo-final.mjs

insert into public.rooms (id, topic, project_name, due_date, token, parts, language)
values (
  'demo-final',
  'Proyecto de Programación: Sistema de gestión de biblioteca',
  'Sistema de biblioteca',
  '2026-11-06',
  'demo-hackatob',
  '["Informe escrito", "Código"]'::jsonb,
  'es'
)
on conflict (id) do update set
  topic = excluded.topic,
  project_name = excluded.project_name,
  due_date = excluded.due_date,
  token = excluded.token,
  parts = excluded.parts,
  language = excluded.language;

delete from public.events where room_id = 'demo-final';
delete from public.room_analysis where room_id = 'demo-final';
delete from public.members where room_id = 'demo-final';

insert into public.members (room_id, name, part)
values
  ('demo-final', 'Ana', 'Informe escrito'),
  ('demo-final', 'Luis', 'Código');

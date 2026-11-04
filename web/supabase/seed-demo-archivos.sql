-- Enlaces de ejemplo, claramente marcados, solo en las salas demo.
insert into public.room_files (room_id, kind, name, url, added_by, source)
select r.room_id, f.kind, f.name, f.url, f.added_by, 'manual'
from (values ('demo-final'), ('demo-ensayo')) as r(room_id)
cross join (values
  ('docs', 'Informe final – borrador (ejemplo)', 'https://docs.google.com/document/d/EJEMPLO-enlaza', 'Ana'),
  ('drive', 'Carpeta del proyecto (ejemplo)', 'https://drive.google.com/drive/folders/EJEMPLO-enlaza', 'Luis'),
  ('figma', 'Diagrama de clases (ejemplo)', 'https://www.figma.com/file/EJEMPLO-enlaza', 'Sofía')
) as f(kind, name, url, added_by)
where exists (select 1 from public.rooms where id = r.room_id)
on conflict (room_id, url) do nothing;

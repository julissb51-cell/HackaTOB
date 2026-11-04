-- Fase 9: archivos y enlaces de la sala.
-- Cada sala guarda enlaces (Drive, Docs, Figma…) y archivos subidos (máx. 10 MB)
-- en el bucket privado room-files. La ruta de cada objeto empieza con el id de
-- la sala: <room_id>/<uuid>/<nombre>. La API escribe con la clave de servicio;
-- las políticas limitan el acceso directo a los miembros de la sala.

create table if not exists public.room_files (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade on update cascade,
  kind text not null,
  name text not null,
  url text,
  storage_path text,
  size_bytes integer,
  mime text,
  added_by text not null,
  added_by_user uuid references auth.users (id) on delete set null,
  source text not null default 'manual',
  source_event_id text,
  created_at timestamptz not null default now(),
  constraint room_files_kind_check check (kind in ('docs', 'drive', 'figma', 'pdf', 'image', 'file', 'link')),
  constraint room_files_source_check check (source in ('manual', 'detectado')),
  constraint room_files_name_len check (char_length(name) between 1 and 200),
  constraint room_files_added_by_len check (char_length(added_by) between 1 and 120),
  constraint room_files_url_check check (url is null or (url ~ '^https?://' and char_length(url) <= 2000)),
  constraint room_files_one_target check ((url is null) <> (storage_path is null)),
  constraint room_files_size_check check (size_bytes is null or (size_bytes >= 0 and size_bytes <= 10485760)),
  constraint room_files_path_check check (storage_path is null or split_part(storage_path, '/', 1) = room_id)
);

-- Las URL nulas (archivos subidos) no chocan entre sí.
create unique index if not exists room_files_room_url_uidx on public.room_files (room_id, url);
create index if not exists room_files_room_created_idx on public.room_files (room_id, created_at desc);

alter table public.room_files enable row level security;

grant select, insert, delete on table public.room_files to authenticated;

drop policy if exists room_files_select_for_member on public.room_files;
create policy room_files_select_for_member
  on public.room_files for select to authenticated
  using (private.can_read_room(room_id));

drop policy if exists room_files_insert_for_member on public.room_files;
create policy room_files_insert_for_member
  on public.room_files for insert to authenticated
  with check (private.can_read_room(room_id) and added_by_user = (select auth.uid()));

drop policy if exists room_files_delete_for_adder_or_owner on public.room_files;
create policy room_files_delete_for_adder_or_owner
  on public.room_files for delete to authenticated
  using (
    added_by_user = (select auth.uid())
    or exists (
      select 1 from public.rooms as room
      where room.id = room_files.room_id and room.created_by = (select auth.uid())
    )
  );

-- La línea de actividad de cada archivo agregado es un evento con ia 'enlaza'.
alter table public.events drop constraint if exists events_ai_check;
alter table public.events add constraint events_ai_check check (
  ai in ('chatgpt', 'gemini', 'cursor', 'claude', 'copilot', 'enlaza')
);

-- Bucket privado, 10 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit)
values ('room-files', 'room-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists room_files_objects_select on storage.objects;
create policy room_files_objects_select
  on storage.objects for select to authenticated
  using (bucket_id = 'room-files' and private.can_read_room((storage.foldername(name))[1]));

drop policy if exists room_files_objects_insert on storage.objects;
create policy room_files_objects_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'room-files' and private.can_read_room((storage.foldername(name))[1]));

drop policy if exists room_files_objects_delete on storage.objects;
create policy room_files_objects_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'room-files'
    and (
      owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.rooms as room
        where room.id = (storage.foldername(name))[1] and room.created_by = (select auth.uid())
      )
    )
  );

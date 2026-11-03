-- Fase 6: sugerencia del analista para todo el equipo.
alter table public.room_analysis add column if not exists consejo text not null default '';

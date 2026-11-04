-- Grok como fuente de IA en los eventos.
alter table public.events drop constraint if exists events_ai_check;
alter table public.events add constraint events_ai_check check (
  ai in ('chatgpt', 'gemini', 'cursor', 'claude', 'copilot', 'grok', 'enlaza')
);

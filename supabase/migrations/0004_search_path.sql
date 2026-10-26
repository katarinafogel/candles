-- Fixed search_path for the grimoire's helper functions (Supabase security advisor, lint 0011),
-- so a caller can't slip in a look-alike table or function through their own schema.
alter function public.is_grimoire_row(text, text) set search_path = public;
alter function public._grimoire_guard() set search_path = public;
alter function public._grimoire_open_tasks() set search_path = public;
alter function public.grimoire_nav() set search_path = public;
alter function public.grimoire_plan(date) set search_path = public;
alter function public.grimoire_day_summary(date) set search_path = public;
alter function public.grimoire_backlog() set search_path = public;
alter function public.grimoire_stuck() set search_path = public;
alter function public.grimoire_joys(date) set search_path = public;
alter function public.grimoire_balance() set search_path = public;

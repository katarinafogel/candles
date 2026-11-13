-- «Книжная полка» гримуара: новый kind book в entities. Выполняется после 0016_short_links.sql.
-- Повторный запуск безопасен.
--
-- Что меняется:
--   * в entities разрешён kind book (книги: хочу прочесть / читаю / прочитано, отметка «куплена»);
--   * is_grimoire_row считает book строкой гримуара: её видит и пишет только роль witch, как заметки.

alter table public.entities drop constraint if exists entities_kind_check;
alter table public.entities add constraint entities_kind_check check (kind in (
  -- workshop
  'mold', 'material', 'mix', 'holder', 'candle', 'pour', 'decor', 'person', 'instruction', 'meta',
  -- grimoire
  'task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal', 'jar', 'jar_tx',
  'person_notes', 'cycle', 'event', 'tarot', 'goal', 'note', 'being', 'book'
));

create or replace function public.is_grimoire_row(p_kind text, p_id text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_kind in ('task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal',
                    'jar', 'jar_tx', 'person_notes', 'cycle', 'event', 'tarot', 'goal', 'note', 'being', 'book')
      or (p_kind = 'meta' and p_id = 'grimoire');
$$;

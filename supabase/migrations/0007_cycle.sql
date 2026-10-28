-- Цикл: новый вид записей гримуара `cycle` (начало и конец месячных, интенсивность, самочувствие).
-- Под той же проверкой роли witch, что и весь гримуар: виден только хозяйке и её ассистенту.

alter table public.entities drop constraint if exists entities_kind_check;
alter table public.entities add constraint entities_kind_check check (kind in (
  -- workshop
  'mold', 'material', 'mix', 'holder', 'candle', 'pour', 'decor', 'person', 'instruction', 'meta',
  -- grimoire
  'task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal', 'jar', 'jar_tx', 'coin_tx',
  'person_notes', 'cycle'
));

create or replace function public.is_grimoire_row(p_kind text, p_id text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_kind in ('task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal',
                    'jar', 'jar_tx', 'coin_tx', 'person_notes', 'cycle')
      or (p_kind = 'meta' and p_id = 'grimoire');
$$;

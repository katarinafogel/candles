-- Монеты убраны из гримуара: награды будут придуманы заново. Выполняется после 0010_soft_delete.sql.
-- Повторный запуск безопасен.
--
-- Что меняется:
--   * удаляются все записи журнала монет (kind coin_tx) — безвозвратно;
--   * из настроек гримуара и из дел, привычек и копилок убираются поля монет;
--   * вид coin_tx больше не разрешён в entities и не считается строкой гримуара;
--   * функция grimoire_balance() удалена, grimoire_day_summary() больше не отдаёт coins.

delete from public.entities where kind = 'coin_tx';

update public.entities set data = data - 'coins'
  where kind = 'meta' and id = 'grimoire' and data ? 'coins';
update public.entities set data = data - 'extraCoins' - 'startedPaid'
  where kind = 'task' and (data ? 'extraCoins' or data ? 'startedPaid');
update public.entities set data = data - 'shields' - 'paidMilestones'
  where kind = 'habit' and (data ? 'shields' or data ? 'paidMilestones');
update public.entities set data = data - 'paidMilestones'
  where kind = 'jar' and data ? 'paidMilestones';

alter table public.entities drop constraint if exists entities_kind_check;
alter table public.entities add constraint entities_kind_check check (kind in (
  -- workshop
  'mold', 'material', 'mix', 'holder', 'candle', 'pour', 'decor', 'person', 'instruction', 'meta',
  -- grimoire
  'task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal', 'jar', 'jar_tx',
  'person_notes', 'cycle'
));

create or replace function public.is_grimoire_row(p_kind text, p_id text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_kind in ('task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal',
                    'jar', 'jar_tx', 'person_notes', 'cycle')
      or (p_kind = 'meta' and p_id = 'grimoire');
$$;

drop function if exists public.grimoire_balance();

-- Done during p_day (by the doneDay stamp the app writes), postponements and mirror entries.
create or replace function public.grimoire_day_summary(p_day date)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
begin
  perform _grimoire_guard();
  return jsonb_build_object(
    'day', p_day,
    'done', coalesce((
      select jsonb_agg(data) from entities
      where owner_id = auth.uid() and kind = 'task' and data->>'status' = 'done' and data->>'doneDay' = p_day::text
    ), '[]'),
    'postponed', coalesce((
      select jsonb_agg(jsonb_build_object('id', data->>'id', 'title', data->>'title', 'postponement', p))
      from entities, jsonb_array_elements(coalesce(data->'postponements', '[]')) p
      where owner_id = auth.uid() and kind = 'task' and p->>'day' = p_day::text
    ), '[]'),
    'journal', coalesce((
      select jsonb_agg(data) from entities
      where owner_id = auth.uid() and kind = 'journal' and data->>'day' = p_day::text
    ), '[]')
  );
end;
$$;

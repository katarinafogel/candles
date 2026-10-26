-- Гримуар дел: роли, новые виды записей, доступ по роли witch, готовые запросы для сводок.
-- Выполняется один раз в SQL Editor после 0001_init.sql. Повторный запуск безопасен.
--
-- Что меняется:
--   * таблица user_roles и функции has_role / grant_role / revoke_role / admin_masters;
--   * в entities разрешены новые kind гримуара;
--   * политика «own entities» делится на две: мастерская — как раньше,
--     гримуар — только своё И только с ролью witch;
--   * функции-сводки для ассистента (только чтение, только для witch).
-- Данные мастерской не трогаются.

-- ---------- роли ----------

create table if not exists public.user_roles (
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('witch', 'admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users on delete set null,
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;
drop policy if exists "own roles: read" on public.user_roles;
create policy "own roles: read" on public.user_roles for select using (user_id = auth.uid());

-- Read only: roles are given out by grant_role, never written by the client directly.
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

-- Security definer: the RLS policies below call it, and it must see user_roles regardless of them.
create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = p_role);
$$;

revoke all on function public.has_role(text) from public, anon;
grant execute on function public.has_role(text) to authenticated;

create or replace function public.grant_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_role('admin') then
    raise exception 'admins only';
  end if;
  if p_role not in ('witch', 'admin') then
    raise exception 'unknown role';
  end if;
  insert into user_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid())
  on conflict (user_id, role) do nothing;
end;
$$;

create or replace function public.revoke_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_role('admin') then
    raise exception 'admins only';
  end if;
  -- The last admin can't lock everyone out of role management.
  if p_role = 'admin' and p_user = auth.uid()
     and (select count(*) from user_roles where role = 'admin') = 1 then
    raise exception 'last admin';
  end if;
  delete from user_roles where user_id = p_user and role = p_role;
end;
$$;

-- For the admin page: masters' names, slugs and roles. Nothing else of anyone's data leaves.
create or replace function public.admin_masters()
returns table (user_id uuid, slug text, name text, roles text[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_role('admin') then
    raise exception 'admins only';
  end if;
  return query
    select p.user_id, p.slug, p.name,
           coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}')
    from profiles p left join user_roles r on r.user_id = p.user_id
    group by p.user_id, p.slug, p.name
    order by p.name, p.slug;
end;
$$;

revoke all on function public.grant_role(uuid, text) from public, anon;
revoke all on function public.revoke_role(uuid, text) from public, anon;
revoke all on function public.admin_masters() from public, anon;
grant execute on function public.grant_role(uuid, text) to authenticated;
grant execute on function public.revoke_role(uuid, text) to authenticated;
grant execute on function public.admin_masters() to authenticated;

-- The first admin. While the project has a single master and nobody holds a role yet,
-- that master gets both roles. Otherwise nothing happens: grant them by hand, e.g.
--   insert into user_roles (user_id, role)
--   select user_id, r from profiles, unnest(array['witch', 'admin']) r where slug = '<адрес мастера>';
do $$
begin
  if not exists (select 1 from user_roles) and (select count(*) from profiles) = 1 then
    insert into user_roles (user_id, role)
    select user_id, r from profiles, unnest(array['witch', 'admin']) r;
  end if;
end;
$$;

-- ---------- новые виды записей ----------

alter table public.entities drop constraint if exists entities_kind_check;
alter table public.entities add constraint entities_kind_check check (kind in (
  -- workshop
  'mold', 'material', 'mix', 'holder', 'candle', 'pour', 'decor', 'person', 'instruction', 'meta',
  -- grimoire
  'task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal', 'jar', 'jar_tx', 'coin_tx',
  'person_notes'
));

-- Which rows belong to the grimoire: its kinds plus its settings row (kind 'meta', id 'grimoire').
create or replace function public.is_grimoire_row(p_kind text, p_id text)
returns boolean
language sql
immutable
as $$
  select p_kind in ('task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal',
                    'jar', 'jar_tx', 'coin_tx', 'person_notes')
      or (p_kind = 'meta' and p_id = 'grimoire');
$$;

grant execute on function public.is_grimoire_row(text, text) to authenticated;

-- Speeds up the grimoire summaries, which filter by kind inside one account.
create index if not exists entities_owner_kind on public.entities (owner_id, kind);

drop policy if exists "own entities" on public.entities;
drop policy if exists "own workshop entities" on public.entities;
drop policy if exists "own grimoire entities" on public.entities;

create policy "own workshop entities" on public.entities for all
  using (owner_id = auth.uid() and not is_grimoire_row(kind, id))
  with check (owner_id = auth.uid() and not is_grimoire_row(kind, id));

-- Without the witch role grimoire rows are neither visible nor writable. Revoking the role
-- hides the data without deleting it; granting it again brings everything back.
create policy "own grimoire entities" on public.entities for all
  using (owner_id = auth.uid() and is_grimoire_row(kind, id) and has_role('witch'))
  with check (owner_id = auth.uid() and is_grimoire_row(kind, id) and has_role('witch'));

-- ---------- сводки для ассистента ----------
-- Read-only, security invoker: they see exactly what RLS lets the signed-in witch see.
-- p_day is the grimoire day (YYYY-MM-DD) computed with the day boundary from the settings.
-- Bodies follow the field names of src/grimoire/types.ts.

create or replace function public._grimoire_guard()
returns void
language plpgsql
stable
as $$
begin
  if auth.uid() is null or not has_role('witch') then
    raise exception 'witch role required';
  end if;
end;
$$;

-- Open tasks: everything not done and not cancelled.
create or replace function public._grimoire_open_tasks()
returns setof jsonb
language sql
stable
as $$
  select data from entities
  where owner_id = auth.uid() and kind = 'task'
    and coalesce(data->>'status', 'open') not in ('done', 'cancelled');
$$;

-- Is the grimoire in «навь» right now (with since when).
create or replace function public.grimoire_nav()
returns jsonb
language plpgsql
stable
as $$
declare v jsonb;
begin
  perform _grimoire_guard();
  select data->'nav' into v from entities where owner_id = auth.uid() and kind = 'meta' and id = 'grimoire';
  return coalesce(v, '{"active": false}'::jsonb);
end;
$$;

-- Plan of the day: tasks chosen for p_day, main → extra → optional.
create or replace function public.grimoire_plan(p_day date)
returns jsonb
language plpgsql
stable
as $$
begin
  perform _grimoire_guard();
  return coalesce((
    select jsonb_agg(t order by case t->>'slot' when 'main' then 0 when 'extra' then 1 else 2 end, t->>'order')
    from _grimoire_open_tasks() t where t->>'doOn' = p_day::text
  ), '[]');
end;
$$;

-- Done during p_day (by the doneDay stamp the app writes) and the coins earned that day.
create or replace function public.grimoire_day_summary(p_day date)
returns jsonb
language plpgsql
stable
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
    'coins', coalesce((
      select sum((data->>'amount')::numeric) from entities
      where owner_id = auth.uid() and kind = 'coin_tx' and data->>'day' = p_day::text
    ), 0),
    'journal', coalesce((
      select jsonb_agg(data) from entities
      where owner_id = auth.uid() and kind = 'journal' and data->>'day' = p_day::text
    ), '[]')
  );
end;
$$;

-- Backlog: open tasks with no day chosen, real deadlines first.
create or replace function public.grimoire_backlog()
returns jsonb
language plpgsql
stable
as $$
begin
  perform _grimoire_guard();
  return coalesce((
    select jsonb_agg(t order by t->>'dueAt' nulls last, t->>'createdAt')
    from _grimoire_open_tasks() t where t->>'doOn' is null
  ), '[]');
end;
$$;

-- Stuck: open tasks postponed three times or more.
create or replace function public.grimoire_stuck()
returns jsonb
language plpgsql
stable
as $$
begin
  perform _grimoire_guard();
  return coalesce((
    select jsonb_agg(t order by jsonb_array_length(t->'postponements') desc)
    from _grimoire_open_tasks() t where jsonb_array_length(coalesce(t->'postponements', '[]')) >= 3
  ), '[]');
end;
$$;

-- Joys ahead: open joys from p_day on, nearest first.
create or replace function public.grimoire_joys(p_day date)
returns jsonb
language plpgsql
stable
as $$
begin
  perform _grimoire_guard();
  return coalesce((
    select jsonb_agg(t order by coalesce(t->>'doOn', t->>'dueAt'))
    from _grimoire_open_tasks() t
    where t->>'type' = 'joy' and coalesce(t->>'doOn', t->>'dueAt', p_day::text) >= p_day::text
  ), '[]');
end;
$$;

-- Coin balance: the sum of the coin journal.
create or replace function public.grimoire_balance()
returns numeric
language plpgsql
stable
as $$
begin
  perform _grimoire_guard();
  return coalesce((select sum((data->>'amount')::numeric) from entities where owner_id = auth.uid() and kind = 'coin_tx'), 0);
end;
$$;

revoke all on function public._grimoire_guard() from public, anon;
revoke all on function public._grimoire_open_tasks() from public, anon;
revoke all on function public.grimoire_nav() from public, anon;
revoke all on function public.grimoire_plan(date) from public, anon;
revoke all on function public.grimoire_day_summary(date) from public, anon;
revoke all on function public.grimoire_backlog() from public, anon;
revoke all on function public.grimoire_stuck() from public, anon;
revoke all on function public.grimoire_joys(date) from public, anon;
revoke all on function public.grimoire_balance() from public, anon;
grant execute on function public._grimoire_guard() to authenticated;
grant execute on function public._grimoire_open_tasks() to authenticated;
grant execute on function public.grimoire_nav() to authenticated;
grant execute on function public.grimoire_plan(date) to authenticated;
grant execute on function public.grimoire_day_summary(date) to authenticated;
grant execute on function public.grimoire_backlog() to authenticated;
grant execute on function public.grimoire_stuck() to authenticated;
grant execute on function public.grimoire_joys(date) to authenticated;
grant execute on function public.grimoire_balance() to authenticated;

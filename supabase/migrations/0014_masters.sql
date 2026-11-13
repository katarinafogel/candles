-- Этап 3 разделения на три приложения, часть 1: роль мастера, приглашения в любое приложение,
-- у бестиария свои люди. Выполняется после 0013_review_tokens.sql. Повторный запуск безопасен.
--
-- Что меняется:
--   * новая роль master — мастерская; роли и приглашения бывают witch (гримуар) и master;
--   * роль master сразу получают те, у кого в мастерской есть своя работа (формы, свечи, склад…);
--   * новый вид записей being — люди бестиария, строка гримуара. Люди мастерской (person) —
--     получатели свечей — остаются мастерской;
--   * каждой ведьме её люди из мастерской копируются в бестиарий с теми же id, так что заметки,
--     дела и даты, привязанные к человеку, остаются при нём. Дальше списки живут отдельно;
--   * агент берёт имена людей для дел из бестиария, а не из мастерской.
-- Мастерская пока открыта всем, кто вошёл: закрываем её ролью master во второй части,
-- когда приложение перестанет писать записи мастерской без роли.

-- ---------- роли ----------

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (role in ('witch', 'master', 'admin'));

alter table public.invites drop constraint if exists invites_role_check;
alter table public.invites add constraint invites_role_check check (role in ('witch', 'master'));

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
  if p_role not in ('witch', 'master', 'admin') then
    raise exception 'unknown role';
  end if;
  insert into user_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid())
  on conflict (user_id, role) do nothing;
end;
$$;

-- An invite opens one app: 'witch' — the grimoire, 'master' — the workshop.
create or replace function public.create_invite(p_role text default 'witch')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not has_role('admin') then
    raise exception 'only an admin can invite' using errcode = '42501';
  end if;
  if p_role not in ('witch', 'master') then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  insert into invites (token, role, created_by) values (v_token, p_role, auth.uid());
  return v_token;
end;
$$;

-- Those who already keep a workshop get its role.
insert into public.user_roles (user_id, role)
select distinct owner_id, 'master' from public.entities
where kind in ('mold', 'material', 'mix', 'holder', 'candle', 'pour', 'decor')
on conflict (user_id, role) do nothing;

-- ---------- люди бестиария ----------

alter table public.entities drop constraint if exists entities_kind_check;
alter table public.entities add constraint entities_kind_check check (kind in (
  -- workshop
  'mold', 'material', 'mix', 'holder', 'candle', 'pour', 'decor', 'person', 'instruction', 'meta',
  -- grimoire
  'task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal', 'jar', 'jar_tx',
  'person_notes', 'cycle', 'event', 'tarot', 'goal', 'note', 'being'
));

create or replace function public.is_grimoire_row(p_kind text, p_id text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_kind in ('task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal',
                    'jar', 'jar_tx', 'person_notes', 'cycle', 'event', 'tarot', 'goal', 'note', 'being')
      or (p_kind = 'meta' and p_id = 'grimoire');
$$;

-- A witch's people move into her bestiary as copies with the same ids.
insert into public.entities (owner_id, kind, id, data, updated_at)
select e.owner_id, 'being', e.id, e.data, now()
from public.entities e
where e.kind = 'person' and e.delete_date is null
  and exists (select 1 from public.user_roles r where r.user_id = e.owner_id and r.role = 'witch')
on conflict (owner_id, kind, id) do nothing;

-- The agent: names for tasks come from the bestiary now. They are still handed over as kind
-- 'person' with the name only, so the agent already deployed keeps working as it is.
create or replace function public.grimoire_rows_as(p_owner uuid)
returns table (kind text, id text, data jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_owner is null or not exists (select 1 from user_roles where user_id = p_owner and role = 'witch') then
    raise exception 'witch role required';
  end if;
  return query
    select e.kind, e.id, e.data from entities e
    where e.owner_id = p_owner and is_grimoire_row(e.kind, e.id)
    union all
    select 'person'::text, e.id, jsonb_build_object('id', e.id, 'name', e.data->>'name') from entities e
    where e.owner_id = p_owner and e.kind = 'being';
end;
$$;

revoke all on function public.grimoire_rows_as(uuid) from public, anon, authenticated;
grant execute on function public.grimoire_rows_as(uuid) to service_role;

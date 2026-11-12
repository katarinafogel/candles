-- Новые виды записей гримуара и приглашения. Выполняется после 0011_drop_coins.sql.
-- Повторный запуск безопасен.
--
-- Что меняется:
--   * в entities разрешены новые kind гримуара: event (длительные события), tarot (карта дня и
--     расклады), goal (цели на год), note (заметки и цитаты) — под той же проверкой роли witch;
--   * таблица invites: одноразовые ссылки-приглашения, которые раздаёт админ; по ссылке новый
--     человек получает роль (сейчас — только witch);
--   * create_invite() — создать приглашение (только админ), redeem_invite(token) — принять его.

alter table public.entities drop constraint if exists entities_kind_check;
alter table public.entities add constraint entities_kind_check check (kind in (
  -- workshop
  'mold', 'material', 'mix', 'holder', 'candle', 'pour', 'decor', 'person', 'instruction', 'meta',
  -- grimoire
  'task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal', 'jar', 'jar_tx',
  'person_notes', 'cycle', 'event', 'tarot', 'goal', 'note'
));

create or replace function public.is_grimoire_row(p_kind text, p_id text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_kind in ('task', 'project', 'habit', 'habit_log', 'wish', 'wheel_practice', 'journal',
                    'jar', 'jar_tx', 'person_notes', 'cycle', 'event', 'tarot', 'goal', 'note')
      or (p_kind = 'meta' and p_id = 'grimoire');
$$;

-- ---------- приглашения ----------

create table if not exists public.invites (
  token text primary key check (length(token) between 16 and 64),
  role text not null default 'witch' check (role in ('witch')),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);

alter table public.invites enable row level security;
drop policy if exists "invites: admins read" on public.invites;
create policy "invites: admins read" on public.invites for select using (public.has_role('admin'));
drop policy if exists "invites: admins revoke" on public.invites;
create policy "invites: admins revoke" on public.invites for update using (public.has_role('admin')) with check (public.has_role('admin'));
-- Rows are made only by create_invite() and taken only by redeem_invite().
revoke all on public.invites from anon;
grant select, update on public.invites to authenticated;

-- A new one-time link for `p_role`, alive for 7 days. Only an admin may make one.
create or replace function public.create_invite(p_role text default 'witch')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Two random UUIDs (built into Postgres, no extension needed): 64 hex characters.
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not has_role('admin') then
    raise exception 'only an admin can invite' using errcode = '42501';
  end if;
  insert into invites (token, role, created_by) values (v_token, p_role, auth.uid());
  return v_token;
end;
$$;

revoke all on function public.create_invite(text) from public, anon;
grant execute on function public.create_invite(text) to authenticated;

-- Takes an invite for the signed-in person: checks it is alive and unused, gives the role, marks it
-- used — in one step, so a link can't be used twice. Returns 'ok' or why not: 'unknown', 'used',
-- 'expired', 'revoked'. The same person opening their own used link again gets 'ok'.
create or replace function public.redeem_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v invites;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into v from invites where token = p_token for update;
  if not found then return 'unknown'; end if;
  if v.revoked_at is not null then return 'revoked'; end if;
  if v.used_by is not null then
    return case when v.used_by = auth.uid() then 'ok' else 'used' end;
  end if;
  if v.expires_at < now() then return 'expired'; end if;
  insert into user_roles (user_id, role, granted_by) values (auth.uid(), v.role, v.created_by)
    on conflict (user_id, role) do nothing;
  update invites set used_by = auth.uid(), used_at = now() where token = p_token;
  return 'ok';
end;
$$;

revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

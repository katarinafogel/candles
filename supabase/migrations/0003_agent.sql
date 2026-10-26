-- Гримуар: доступ для агента (ассистента в запланированных задачах). Выполняется после 0002_grimoire.sql.
-- Повторный запуск безопасен.
--
-- Агент ходит не в базу, а в Edge Function grimoire-mcp. Она узнаёт хозяйку по личному ключу,
-- загружает её гримуар, выполняет действие по тем же правилам, что и приложение, и записывает
-- результат. Ключ service_role остаётся внутри функции и никуда не уходит.
--
-- Ключ хранится только хэшем (sha-256). Сам ключ показывается один раз, когда его выпускают
-- в гримуаре («Ещё» → «Доступ для агента»). Отозванный ключ перестаёт работать сразу.

create table if not exists public.agent_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  label text not null default '' check (length(label) <= 100),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists agent_keys_owner on public.agent_keys (owner_id, created_at);

alter table public.agent_keys enable row level security;
drop policy if exists "own agent keys: read" on public.agent_keys;
create policy "own agent keys: read" on public.agent_keys for select using (owner_id = auth.uid());

-- The client sees its keys but never their hashes, and changes them only through the functions below.
revoke all on public.agent_keys from anon, authenticated;
grant select (id, label, created_at, last_used_at, revoked_at) on public.agent_keys to authenticated;

create or replace function public.create_agent_key(p_label text, p_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not has_role('witch') then
    raise exception 'witch role required';
  end if;
  if p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad key hash';
  end if;
  if (select count(*) from agent_keys where owner_id = auth.uid() and revoked_at is null) >= 10 then
    raise exception 'too many keys';
  end if;
  insert into agent_keys (owner_id, label, key_hash) values (auth.uid(), left(coalesce(p_label, ''), 100), p_hash)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.revoke_agent_key(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update agent_keys set revoked_at = now() where id = p_id and owner_id = auth.uid() and revoked_at is null;
$$;

revoke all on function public.create_agent_key(text, text) from public, anon;
revoke all on function public.revoke_agent_key(uuid) from public, anon;
grant execute on function public.create_agent_key(text, text) to authenticated;
grant execute on function public.revoke_agent_key(uuid) to authenticated;

-- ---------- for the Edge Function only (service_role) ----------

-- Whose key it is. Nothing for a revoked key or an owner who lost the witch role.
create or replace function public.agent_owner(p_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  update agent_keys k set last_used_at = now()
  where k.key_hash = p_hash and k.revoked_at is null
    and exists (select 1 from user_roles r where r.user_id = k.owner_id and r.role = 'witch')
  returning k.owner_id into v_owner;
  return v_owner;
end;
$$;

-- Writes the agent's changes for one owner in one transaction, grimoire rows only:
-- the workshop, profiles and reviews are out of its reach whatever the function sends.
create or replace function public.grimoire_apply_as(p_owner uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c jsonb;
begin
  if p_owner is null or not exists (select 1 from user_roles where user_id = p_owner and role = 'witch') then
    raise exception 'witch role required';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 2000 then
    raise exception 'bad changes';
  end if;
  for c in select * from jsonb_array_elements(p_changes) loop
    if not is_grimoire_row(c->>'kind', c->>'id') then
      raise exception 'not a grimoire row: %', c->>'kind';
    end if;
    if c->>'op' = 'delete' then
      delete from entities where owner_id = p_owner and kind = c->>'kind' and id = c->>'id';
    else
      insert into entities (owner_id, kind, id, data, updated_at)
      values (p_owner, c->>'kind', c->>'id', c->'data', now())
      on conflict (owner_id, kind, id) do update set data = excluded.data, updated_at = now();
    end if;
  end loop;
end;
$$;

revoke all on function public.agent_owner(text) from public, anon, authenticated;
revoke all on function public.grimoire_apply_as(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.agent_owner(text) to service_role;
grant execute on function public.grimoire_apply_as(uuid, jsonb) to service_role;

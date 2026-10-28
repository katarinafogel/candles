-- Push-уведомления гримуара. Устройство подписывается само (своя строка в push_subscriptions); что и
-- когда слать, решает функция grimoire-push по настройкам в мета гримуара. Ключи VAPID и ключ
-- запуска по расписанию лежат в push_config, которую видит только функция (service role).

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  keys jsonb not null check (pg_column_size(keys) < 2048),
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and has_role('witch'));
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- What was already sent today, so each kind goes once a day. Only the function writes it.
create table if not exists public.push_state (
  owner_id uuid primary key references auth.users on delete cascade,
  day text not null,
  sent text[] not null default '{}'
);
alter table public.push_state enable row level security;
revoke all on public.push_state from anon, authenticated;

create table if not exists public.push_config (
  id int primary key check (id = 1),
  public_key text,
  private_key text,
  cron_key text not null
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
insert into public.push_config (id, cron_key)
values (1, md5(random()::text || clock_timestamp()::text) || md5(random()::text))
on conflict (id) do nothing;

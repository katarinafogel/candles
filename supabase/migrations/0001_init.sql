-- Мастерская свечей: схема Supabase.
-- Выполняется один раз в SQL Editor проекта (или `supabase db push`).
--
-- Модель хранения: каждая сущность приложения (форма, материал, замес, подсвечник,
-- свеча, заливка, партия декора, человек, инструкция, служебные счётчики и настройки)
-- — строка таблицы entities с JSON-данными. Вся бизнес-логика (расчёты, этапы,
-- списание) живёт в приложении, а база хранит результат и гарантирует, что
-- каждый мастер видит и меняет только свои строки (RLS).
-- Отзывы лежат отдельно: их пишут получатели без входа через функцию submit_review.

-- ---------- профили мастеров ----------

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  name text not null default '' check (length(name) <= 100),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "own profile: read" on public.profiles for select using (user_id = auth.uid());
create policy "own profile: create" on public.profiles for insert with check (user_id = auth.uid());
create policy "own profile: update" on public.profiles for update using (user_id = auth.uid());

-- The slug is printed in QR codes, so it can't be changed after creation.
revoke all on public.profiles from anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;

-- ---------- данные мастерской ----------

create table public.entities (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in (
    'mold', 'material', 'mix', 'holder', 'candle', 'pour', 'decor', 'person', 'instruction', 'meta'
  )),
  id text not null check (length(id) between 1 and 64),
  data jsonb not null check (pg_column_size(data) < 262144),
  updated_at timestamptz not null default now(),
  primary key (owner_id, kind, id)
);

alter table public.entities enable row level security;
create policy "own entities" on public.entities for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke all on public.entities from anon, authenticated;
grant select, insert, update, delete on public.entities to authenticated;

-- ---------- отзывы ----------

create table public.reviews (
  id uuid primary key,
  owner_id uuid not null references auth.users on delete cascade,
  candle_id text not null,
  data jsonb not null check (pg_column_size(data) < 16384),
  source text not null default 'qr' check (source in ('qr', 'manual')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index reviews_owner_created on public.reviews (owner_id, created_at);
create index reviews_owner_candle on public.reviews (owner_id, candle_id, created_at);

alter table public.reviews enable row level security;
create policy "own reviews" on public.reviews for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke all on public.reviews from anon, authenticated;
grant select, insert, update, delete on public.reviews to authenticated;

-- ---------- запись изменений мастера одной транзакцией ----------

-- p_changes: [{ "op": "upsert" | "delete", "kind": "...", "id": "...", "data": {...} }, ...]
-- Several entities changed by one step (a mix creates holders and takes materials)
-- are saved together or not at all.
create function public.apply_changes(p_changes jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  c jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 2000 then
    raise exception 'bad changes';
  end if;

  for c in select * from jsonb_array_elements(p_changes) loop
    if c->>'kind' = 'review' then
      if c->>'op' = 'delete' then
        delete from reviews where id = (c->>'id')::uuid and owner_id = uid;
      else
        insert into reviews (id, owner_id, candle_id, data, source, read)
        values (
          (c->>'id')::uuid, uid, c->'data'->>'candleId', c->'data',
          coalesce(c->'data'->>'source', 'manual'), coalesce((c->'data'->>'read')::boolean, false)
        )
        on conflict (id) do update
          set candle_id = excluded.candle_id, data = excluded.data, read = excluded.read
          where reviews.owner_id = uid;
      end if;
    elsif c->>'op' = 'delete' then
      delete from entities where owner_id = uid and kind = c->>'kind' and id = c->>'id';
    else
      insert into entities (owner_id, kind, id, data, updated_at)
      values (uid, c->>'kind', c->>'id', c->'data', now())
      on conflict (owner_id, kind, id) do update set data = excluded.data, updated_at = now();
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_changes(jsonb) from public, anon;
grant execute on function public.apply_changes(jsonb) to authenticated;

-- ---------- выбор адреса мастера ----------

create function public.slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_slug ~ '^[a-z0-9][a-z0-9-]{2,29}$'
     and not exists (select 1 from profiles where slug = p_slug);
$$;

revoke all on function public.slug_available(text) from public, anon;
grant execute on function public.slug_available(text) to authenticated;

-- ---------- публичная страница свечи ----------

-- Only the candle name, the instruction text and the master's name leave the database.
create function public.candle_public(p_slug text, p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_master text;
  v_candle jsonb;
  v_instruction text;
begin
  select user_id, name into v_owner, v_master from profiles where slug = lower(p_slug);
  if v_owner is null then
    return jsonb_build_object('found', false);
  end if;
  select data into v_candle from entities where owner_id = v_owner and kind = 'candle' and id = p_id;
  if v_candle is null then
    return jsonb_build_object('found', false, 'master', v_master);
  end if;
  select data->>'text' into v_instruction
    from entities where owner_id = v_owner and kind = 'instruction' and id = v_candle->>'instructionId';
  return jsonb_build_object(
    'found', true,
    'master', v_master,
    'name', v_candle->>'name',
    'instruction', coalesce(v_instruction, '')
  );
end;
$$;

revoke all on function public.candle_public(text, text) from public;
grant execute on function public.candle_public(text, text) to anon, authenticated;

-- ---------- отзыв без входа ----------

create function public._num(v jsonb, lo numeric, hi numeric, digits int default 2)
returns numeric
language sql
immutable
as $$
  select case when jsonb_typeof(v) = 'number'
    then round(least(hi, greatest(lo, (v #>> '{}')::numeric)), digits) end;
$$;

create function public.submit_review(p_slug text, p_review jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_id uuid;
  v_candle text := p_review->>'candleId';
  v_clean jsonb;
  k text;
  v text;
  choices constant jsonb := '{
    "scentCold": ["none", "weak", "nice", "strong"],
    "scentHot": ["none", "weak", "nice", "strong"],
    "burn": ["weak", "normal", "strong"],
    "wentOut": ["no", "sometimes", "often"],
    "soot": ["no", "little", "strong"],
    "heat": ["cool", "warm", "hot"],
    "crack": ["no", "crack", "broken"],
    "leak": ["no", "yes"],
    "instructionClear": ["yes", "notReally", "didntRead"],
    "finished": ["yes", "burning"]
  }';
begin
  if pg_column_size(p_review) > 16384 then
    raise exception 'review too large';
  end if;
  select user_id into v_owner from profiles where slug = lower(p_slug);
  if v_owner is null then
    raise exception 'unknown master';
  end if;
  if v_candle is null or v_candle !~ '^S-[0-9]{1,6}$'
     or not exists (select 1 from entities where owner_id = v_owner and kind = 'candle' and id = v_candle) then
    raise exception 'unknown candle';
  end if;
  begin
    v_id := (p_review->>'id')::uuid;
  exception when others then
    raise exception 'bad review id';
  end;
  -- A retry of the same review (same UUID from the recipient's phone) is not a duplicate row.
  if exists (select 1 from reviews where id = v_id) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if (select count(*) from reviews where owner_id = v_owner and created_at > now() - interval '1 hour') >= 60
     or (select count(*) from reviews
         where owner_id = v_owner and candle_id = v_candle and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many reviews';
  end if;

  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'id', v_id,
    'candleId', v_candle,
    'overall', _num(p_review->'overall', 1, 10, 0),
    'design', _num(p_review->'design', 1, 10, 0),
    'burnHours', _num(p_review->'burnHours', 0, 10000),
    'sessions', _num(p_review->'sessions', 0, 10000, 0),
    'selfExtinguished', _num(p_review->'selfExtinguished', 0, 10000, 0),
    'comment', nullif(left(p_review->>'comment', 3000), ''),
    'name', nullif(left(p_review->>'name', 100), '')
  ));
  for k in select jsonb_object_keys(choices) loop
    v := p_review->>k;
    if v is not null and (choices->k) ? v then
      v_clean := v_clean || jsonb_build_object(k, v);
    end if;
  end loop;

  insert into reviews (id, owner_id, candle_id, data, source, read)
  values (v_id, v_owner, v_candle, v_clean, 'qr', false);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_review(text, jsonb) from public;
grant execute on function public.submit_review(text, jsonb) to anon, authenticated;

-- ---------- проверка, что проект жив (GitHub Actions раз в 3 дня) ----------

create function public.ping()
returns text
language sql
stable
as $$ select 'ok' $$;

grant execute on function public.ping() to anon;

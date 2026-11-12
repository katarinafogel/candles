-- Secret per-candle tokens for the QR review form.
-- The QR link carries the token (#/c/<master>/<candle>/<token>); submit_review rejects a review
-- without a matching token, so candle numbers can't be enumerated to spam the master.

create table if not exists public.candle_review_tokens (
  owner_id uuid not null references auth.users(id) on delete cascade,
  candle_id text not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  primary key (owner_id, candle_id)
);
alter table public.candle_review_tokens enable row level security;
drop policy if exists "own review tokens: read" on public.candle_review_tokens;
create policy "own review tokens: read" on public.candle_review_tokens
  for select using (owner_id = auth.uid());

-- Candles whose old tokenless QR codes are already with people. Each row stops working at `until`.
create table if not exists public.review_token_exempt (
  owner_id uuid not null references auth.users(id) on delete cascade,
  candle_id text not null,
  until timestamptz not null,
  primary key (owner_id, candle_id)
);
alter table public.review_token_exempt enable row level security;
drop policy if exists "own exemptions: read" on public.review_token_exempt;
create policy "own exemptions: read" on public.review_token_exempt
  for select using (owner_id = auth.uid());

-- The token check is on for everyone. It can be switched off for a master only here, in the database:
--   insert into review_settings (owner_id, require_token) values ('<uuid>', false)
--   on conflict (owner_id) do update set require_token = false;
-- The app can read this row but never write it.
create table if not exists public.review_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  require_token boolean not null default true
);
alter table public.review_settings alter column require_token set default true;
alter table public.review_settings enable row level security;
drop policy if exists "own review settings: read" on public.review_settings;
create policy "own review settings: read" on public.review_settings
  for select using (owner_id = auth.uid());

drop function if exists public.candle_review_token(text);

-- Tokens for my candles, created on first request: {"S-0042": "<token>", ...}.
-- Candles not (yet) on the server are left out.
create or replace function public.review_tokens(p_ids text[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 500 then
    raise exception 'too many candles';
  end if;
  insert into candle_review_tokens (owner_id, candle_id, token)
  select auth.uid(), e.id, replace(gen_random_uuid()::text, '-', '')
  from entities e
  where e.owner_id = auth.uid() and e.kind = 'candle' and e.id = any (p_ids)
  on conflict (owner_id, candle_id) do nothing;
  return coalesce(
    (select jsonb_object_agg(candle_id, token) from candle_review_tokens
      where owner_id = auth.uid() and candle_id = any (p_ids)),
    '{}'::jsonb
  );
end;
$$;
revoke execute on function public.review_tokens(text[]) from public, anon;
grant execute on function public.review_tokens(text[]) to authenticated;

-- Candles already given away keep working without a token for 2 months.
insert into public.review_token_exempt (owner_id, candle_id, until)
select owner_id, id, now() + interval '2 months'
from public.entities
where kind = 'candle' and delete_date is null and data->>'stage' = 'given'
on conflict do nothing;

create or replace function public.submit_review(p_slug text, p_review jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_owner uuid;
  v_id uuid;
  v_candle text := p_review->>'candleId';
  v_token text := nullif(p_review->>'token', '');
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
     or not exists (select 1 from entities where owner_id = v_owner and kind = 'candle' and id = v_candle and delete_date is null) then
    raise exception 'unknown candle';
  end if;
  if v_token is not null then
    if not exists (select 1 from candle_review_tokens where owner_id = v_owner and candle_id = v_candle and token = v_token) then
      raise exception 'bad token';
    end if;
  elsif coalesce((select require_token from review_settings where owner_id = v_owner), true)
        and not exists (select 1 from review_token_exempt where owner_id = v_owner and candle_id = v_candle and until > now()) then
    raise exception 'token required';
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
    'name', nullif(left(p_review->>'name', 100), ''),
    'contact', nullif(left(p_review->>'contact', 200), '')
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
$function$;

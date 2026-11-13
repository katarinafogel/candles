-- Этап 5: короткие ссылки для QR — katarinafogel.art/r/<код> вместо /candles-review/<мастер>/<свеча>/<токен>.
-- Код — 8 знаков из 31 (без похожих 0/o, 1/l/i), живёт рядом с секретным токеном свечи и заменяет
-- всю длинную ссылку: витрина спрашивает у базы, куда он ведёт. Длинные ссылки продолжают работать.
-- Выполняется после 0015. Повторный запуск безопасен.

create or replace function public.short_code()
returns text
language sql
volatile
set search_path = public
as $$
  select string_agg(substr('23456789abcdefghjkmnpqrstuvwxyz', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$$;

alter table public.candle_review_tokens add column if not exists code text;
update public.candle_review_tokens set code = short_code() where code is null;
alter table public.candle_review_tokens alter column code set default public.short_code();
alter table public.candle_review_tokens alter column code set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'candle_review_tokens_code_key') then
    alter table public.candle_review_tokens add constraint candle_review_tokens_code_key unique (code);
  end if;
end;
$$;

-- Links for my candles, created on first request: {"S-0042": {"token": "…", "code": "…"}, ...}.
create or replace function public.review_links(p_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public
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
    (select jsonb_object_agg(candle_id, jsonb_build_object('token', token, 'code', code)) from candle_review_tokens
      where owner_id = auth.uid() and candle_id = any (p_ids)),
    '{}'::jsonb
  );
end;
$$;
revoke execute on function public.review_links(text[]) from public, anon;
grant execute on function public.review_links(text[]) to authenticated;

-- For the showcase, without sign-in: where a short code leads ({"slug", "candle", "token"}), or null.
create or replace function public.resolve_review_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('slug', p.slug, 'candle', t.candle_id, 'token', t.token)
  from candle_review_tokens t
  join profiles p on p.user_id = t.owner_id
  where t.code = lower(p_code) and length(p_code) = 8;
$$;
revoke execute on function public.resolve_review_code(text) from public;
grant execute on function public.resolve_review_code(text) to anon, authenticated;

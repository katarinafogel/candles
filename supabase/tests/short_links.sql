-- Migration 0016: short QR codes. Runs after 0016 (twice).
\set ON_ERROR_STOP on

insert into public.entities (owner_id, kind, id, data) values
  ('00000000-0000-0000-0000-00000000000a', 'candle', 'S-0099', '{"id": "S-0099"}') on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare
  l jsonb := review_links(array['S-0099', 'S-nope']);
  code text := l->'S-0099'->>'code';
  r jsonb;
begin
  assert l ? 'S-0099' and not l ? 'S-nope', 'links for my candles only';
  assert code ~ '^[2-9a-hjkmnp-z]{8}$', 'eight easy-to-read signs';
  assert (review_links(array['S-0099'])->'S-0099'->>'code') = code, 'the code stays';
  perform set_config('test.code', code, false);
  perform set_config('test.token', l->'S-0099'->>'token', false);
end;
$$;

-- Anyone holding the QR (no sign-in) learns where it leads.
reset role;
set role anon;
do $$
declare
  r jsonb := resolve_review_code(current_setting('test.code'));
begin
  assert r->>'slug' = 'witch' and r->>'candle' = 'S-0099' and r->>'token' = current_setting('test.token'), 'the code leads to the candle';
  assert resolve_review_code(upper(current_setting('test.code')))->>'candle' = 'S-0099', 'capital letters are fine';
  assert resolve_review_code('zzzzzzzz') is null, 'an unknown code leads nowhere';
end;
$$;
reset role;

-- Codes given before 0016 (rows without one) got a code too.
do $$
begin
  assert not exists (select 1 from candle_review_tokens where code is null), 'every token has a code';
end;
$$;

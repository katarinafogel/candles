-- Migration 0012: the new grimoire kinds and the invites. Runs after drop_coins.sql.
\set ON_ERROR_STOP on

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000c') on conflict do nothing;

set role authenticated;

-- The witch (an admin) writes the new kinds and makes an invite.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare
  t text;
begin
  perform apply_changes('[
    {"op": "upsert", "kind": "event", "id": "e1", "data": {"id": "e1", "title": "Калининград", "from": "2026-11-10", "to": "2026-11-15"}},
    {"op": "upsert", "kind": "tarot", "id": "r1", "data": {"id": "r1", "type": "day", "day": "2026-11-12", "cards": [{"card": "m18"}]}},
    {"op": "upsert", "kind": "goal", "id": "g1", "data": {"id": "g1", "year": 2027, "title": "Машина", "status": "active"}},
    {"op": "upsert", "kind": "note", "id": "n1", "data": {"id": "n1", "text": "цитата", "tags": []}}
  ]');
  assert (select count(*) from entities where kind in ('event', 'tarot', 'goal', 'note')) = 4, 'the new kinds are stored';
  assert is_grimoire_row('note', 'n1'), 'a note is a grimoire row';

  t := create_invite();
  assert length(t) = 64, 'a 64-character token';
  perform set_config('test.token', t, false);
end;
$$;

-- Someone without the admin role can't make one, nor see the invites.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$
begin
  begin
    perform create_invite();
    raise exception 'only an admin can invite';
  exception when insufficient_privilege then
    null;
  end;
  assert (select count(*) from invites) = 0, 'invites are hidden from others';
  assert not has_role('witch'), 'no role before the invite';
  assert redeem_invite('nope') = 'unknown', 'a made-up token';
  assert redeem_invite(current_setting('test.token')) = 'ok', 'the invite is taken';
  assert has_role('witch'), 'the role came with it';
  assert redeem_invite(current_setting('test.token')) = 'ok', 'the same person again is fine';
end;
$$;

-- The link is used up for anyone else.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
begin
  assert redeem_invite(current_setting('test.token')) = 'used', 'a used link';
end;
$$;

-- An expired one and a revoked one.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare
  t1 text := create_invite();
  t2 text := create_invite();
begin
  -- An admin may change her invites (revoke them); the expiry is moved here only for the test.
  update invites set revoked_at = now() where token = t2;
  update invites set expires_at = now() - interval '1 day' where token = t1;
  perform set_config('test.revoked', t2, false);
  perform set_config('test.expired', t1, false);
end;
$$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
begin
  assert redeem_invite(current_setting('test.expired')) = 'expired', 'an expired link';
  assert redeem_invite(current_setting('test.revoked')) = 'revoked', 'a revoked link';
end;
$$;

reset role;

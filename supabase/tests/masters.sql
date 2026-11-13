-- Migration 0014: the master role, invites per app, the bestiary's own people. Runs after 0014 (twice).
\set ON_ERROR_STOP on

do $$
begin
  assert exists (select 1 from user_roles where user_id = '00000000-0000-0000-0000-00000000000a' and role = 'master'),
    'whoever keeps a workshop becomes a master';
  assert not exists (select 1 from user_roles where user_id = '00000000-0000-0000-0000-00000000000d'),
    'no workshop work, no role';
  assert (select count(*) from entities where kind = 'being' and owner_id = '00000000-0000-0000-0000-00000000000a' and id = 'p1') = 1,
    'a witch''s person is copied into her bestiary with the same id';
  assert (select data->>'name' from entities where kind = 'being' and id = 'p1') = 'Сестра', 'with the same data';
  assert not exists (select 1 from entities where kind = 'being' and id = 'p2'), 'people in the bin stay behind';
  assert not exists (select 1 from entities where kind = 'being' and owner_id = '00000000-0000-0000-0000-00000000000d'),
    'only witches get a bestiary';
  assert exists (select 1 from entities where kind = 'person' and id = 'p1'), 'the workshop keeps its own';
  assert is_grimoire_row('being', 'p1') and not is_grimoire_row('person', 'p1'), 'being is the grimoire''s, person the workshop''s';
  -- The agent sees bestiary names as people, nothing of the workshop's people.
  assert (select count(*) from grimoire_rows_as('00000000-0000-0000-0000-00000000000a') r
          where r.kind = 'person' and r.id = 'p1' and r.data = '{"id": "p1", "name": "Сестра"}'::jsonb) = 1,
    'the agent gets the name from the bestiary';
end;
$$;

set role authenticated;

-- The admin invites into the workshop; an unknown role is refused.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare
  t text := create_invite('master');
begin
  perform set_config('test.master_token', t, false);
  begin
    perform create_invite('admin');
    raise exception 'an admin invite must be refused';
  exception when invalid_parameter_value then
    null;
  end;
  assert (select role from invites where token = t) = 'master', 'a workshop invite';
end;
$$;

-- Taking it gives the workshop, not the grimoire.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
do $$
begin
  assert redeem_invite(current_setting('test.master_token')) = 'ok', 'the invite is taken';
  assert has_role('master'), 'the master role came with it';
  assert not has_role('witch'), 'the grimoire stays closed';
  -- Without the witch role the bestiary is out of reach.
  begin
    perform apply_changes('[{"op": "upsert", "kind": "being", "id": "x", "data": {"id": "x", "name": "x"}}]');
    raise exception 'a bestiary row without the witch role';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

-- The admin hands out the master role by hand too.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select grant_role('00000000-0000-0000-0000-00000000000b', 'master');

reset role;
do $$
begin
  assert exists (select 1 from user_roles where user_id = '00000000-0000-0000-0000-00000000000b' and role = 'master'), 'granted by hand';
end;
$$;

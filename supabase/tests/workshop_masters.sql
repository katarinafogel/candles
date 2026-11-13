-- Migration 0015: the workshop's rows are for masters only. Runs after masters.sql.
\set ON_ERROR_STOP on

-- A witch without the workshop.
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000e') on conflict do nothing;
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000e', 'witch') on conflict do nothing;
insert into public.entities (owner_id, kind, id, data) values
  ('00000000-0000-0000-0000-00000000000e', 'meta', 'settings', '{}') on conflict do nothing;

set role authenticated;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
do $$
begin
  assert (select count(*) from entities where kind = 'meta' and id = 'settings') = 0, 'no workshop rows without the role, not even her own';
  begin
    perform apply_changes('[{"op": "upsert", "kind": "mold", "id": "m-e", "data": {"id": "m-e"}}]');
    raise exception 'a workshop row without the master role';
  exception when insufficient_privilege then
    null;
  end;
  -- The grimoire stays hers.
  perform apply_changes('[{"op": "upsert", "kind": "task", "id": "t-e", "data": {"id": "t-e", "title": "x"}}]');
  assert (select count(*) from entities where kind = 'task' and id = 't-e') = 1, 'the grimoire works without the workshop';
end;
$$;

-- A master keeps her workshop.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
begin
  assert (select count(*) from entities where kind = 'person' and id = 'p1') = 1, 'a master reads her workshop';
  perform apply_changes('[{"op": "upsert", "kind": "mold", "id": "m-a", "data": {"id": "m-a"}}]');
  assert (select count(*) from entities where kind = 'mold' and id = 'm-a') = 1, 'and writes to it';
end;
$$;

reset role;

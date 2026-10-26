-- Migration 0003: agent keys and writing on the owner's behalf. Runs after grimoire_rls.sql.
\set ON_ERROR_STOP on

-- ---------- the witch issues a key ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

select create_agent_key('утренний агент', repeat('a', 64));

do $$
begin
  assert (select count(*) from agent_keys) = 1, 'sees her key';
  -- The hash column is not readable by the client.
  begin
    perform key_hash from agent_keys;
    raise exception 'key_hash must not be readable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform create_agent_key('x', 'not a hash');
    raise exception 'bad hash must fail';
  exception when raise_exception then
    if sqlerrm <> 'bad key hash' then raise; end if;
  end;
  begin
    perform agent_owner(repeat('a', 64));
    raise exception 'agent_owner is for the server only';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- ---------- a master without the witch role can't have keys ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
begin
  perform create_agent_key('x', repeat('b', 64));
  raise exception 'no key without the witch role';
exception when raise_exception then
  if sqlerrm <> 'witch role required' then raise; end if;
end;
$$;

-- ---------- the server side ----------
reset role;
set role service_role;
reset request.jwt.claim.sub;

do $$
declare v uuid;
begin
  v := agent_owner(repeat('a', 64));
  assert v = '00000000-0000-0000-0000-00000000000a', 'key resolves to its owner';
  assert agent_owner(repeat('c', 64)) is null, 'unknown key resolves to nobody';
  perform grimoire_apply_as(v, '[{"op": "upsert", "kind": "task", "id": "agent1", "data": {"id": "agent1", "title": "от агента"}}]');
  assert (select data->>'title' from grimoire_rows_as(v) where kind = 'task' and id = 'agent1') = 'от агента', 'agent writes and reads grimoire rows';
  assert not exists (select 1 from grimoire_rows_as(v) where kind = 'mold'), 'workshop rows are not read';
  -- No direct access to the table, like in the live project.
  begin
    perform 1 from entities;
    raise exception 'service_role must not read entities directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform grimoire_apply_as(v, '[{"op": "upsert", "kind": "mold", "id": "M-009", "data": {}}]');
    raise exception 'workshop rows must be refused';
  exception when raise_exception then
    if sqlerrm not like 'not a grimoire row%' then raise; end if;
  end;
  begin
    perform grimoire_apply_as('00000000-0000-0000-0000-00000000000b', '[]');
    raise exception 'owner without the witch role must be refused';
  exception when raise_exception then
    if sqlerrm <> 'witch role required' then raise; end if;
  end;
end;
$$;

-- ---------- revoking ----------
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select revoke_agent_key((select id from agent_keys limit 1));

reset role;
set role service_role;
do $$
begin
  assert agent_owner(repeat('a', 64)) is null, 'a revoked key stops working';
end;
$$;

\echo 'agent keys: ok'

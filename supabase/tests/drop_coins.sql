-- Migration 0011: the coin journal is gone and can't come back. Runs after soft_delete.sql; the
-- witch's coin row from grimoire_rls.sql was there before the migration.
\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

do $$
begin
  assert (select count(*) from entities where kind = 'coin_tx') = 0, 'coin rows are deleted';
  assert to_regprocedure('public.grimoire_balance()') is null, 'the balance function is dropped';
  assert not (grimoire_day_summary('2026-10-26') ? 'coins'), 'the day summary has no coins';
  assert (select count(*) from entities where kind = 'task') >= 2, 'the deeds stay';

  begin
    perform apply_changes('[{"op": "upsert", "kind": "coin_tx", "id": "c2", "data": {"id": "c2", "amount": 5}}]');
    raise exception 'a coin row must be refused';
  exception when check_violation then
    null;
  end;
end;
$$;

reset role;

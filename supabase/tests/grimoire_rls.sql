-- Access rules of migration 0002, checked as the signed-in masters would hit them through PostgREST.
-- Witch (a): the only master when 0002 ran, so she got both roles. Master (b) joins later without roles.
\set ON_ERROR_STOP on

insert into public.profiles (user_id, slug, name) values ('00000000-0000-0000-0000-00000000000b', 'master', 'Мастер');

-- ---------- as the witch ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

do $$
begin
  assert (select array_agg(role order by role) from user_roles) = array['admin', 'witch'], 'bootstrap gave both roles';
  assert has_role('witch') and has_role('admin'), 'has_role sees own roles';
  -- Workshop data is still there and writable.
  assert (select count(*) from entities where kind = 'mold') = 1, 'workshop rows visible';
  perform apply_changes('[
    {"op": "upsert", "kind": "mold", "id": "M-002", "data": {"id": "M-002"}},
    {"op": "upsert", "kind": "task", "id": "t1", "data": {"id": "t1", "title": "Помыть окна", "status": "open", "doOn": "2026-10-26", "slot": "main", "type": "deed", "postponements": [{"day": "2026-10-25"}, {"day": "2026-10-24"}, {"day": "2026-10-23"}]}},
    {"op": "upsert", "kind": "task", "id": "t2", "data": {"id": "t2", "title": "Кино", "status": "open", "type": "joy", "doOn": "2026-10-30", "postponements": []}},
    {"op": "upsert", "kind": "coin_tx", "id": "c1", "data": {"id": "c1", "amount": 75, "day": "2026-10-26"}},
    {"op": "upsert", "kind": "meta", "id": "grimoire", "data": {"nav": {"active": false}}}
  ]');
  assert (select count(*) from entities where kind = 'task') = 2, 'witch writes grimoire rows';
  assert jsonb_array_length(grimoire_plan('2026-10-26')) = 1, 'plan of the day';
  assert jsonb_array_length(grimoire_stuck()) = 1, 'stuck after three postponements';
  assert jsonb_array_length(grimoire_joys('2026-10-26')) = 1, 'joys ahead';
  assert jsonb_array_length(grimoire_backlog()) = 0, 'backlog';
  assert grimoire_balance() = 75, 'coin balance';
  assert (grimoire_nav()->>'active')::boolean = false, 'nav flag';
  assert (grimoire_day_summary('2026-10-26')->>'coins')::numeric = 75, 'day summary';
  assert (select count(*) from admin_masters()) = 2, 'admin sees the masters list';
end;
$$;

-- The client can't write roles itself.
do $$
begin
  insert into user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000b', 'witch');
  raise exception 'direct insert into user_roles must fail';
exception when insufficient_privilege then null;
end;
$$;

-- The last admin can't drop her own admin role.
do $$
begin
  perform revoke_role('00000000-0000-0000-0000-00000000000a', 'admin');
  raise exception 'last admin must stay';
exception when raise_exception then
  if sqlerrm <> 'last admin' then raise; end if;
end;
$$;

-- ---------- as a master without roles ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
begin
  assert not has_role('witch'), 'no roles yet';
  assert (select count(*) from entities) = 0, 'sees nobody else''s rows';
  perform apply_changes('[{"op": "upsert", "kind": "mold", "id": "M-001", "data": {"id": "M-001"}}]');
  assert (select count(*) from entities) = 1, 'workshop works without roles';
end;
$$;

do $$
begin
  perform apply_changes('[{"op": "upsert", "kind": "task", "id": "x", "data": {"id": "x"}}]');
  raise exception 'grimoire row without the witch role must fail';
exception when insufficient_privilege then null;
end;
$$;

do $$
begin
  perform apply_changes('[{"op": "upsert", "kind": "meta", "id": "grimoire", "data": {}}]');
  raise exception 'grimoire settings without the witch role must fail';
exception when insufficient_privilege then null;
end;
$$;

do $$
begin
  perform grimoire_plan('2026-10-26');
  raise exception 'summaries need the witch role';
exception when raise_exception then
  if sqlerrm <> 'witch role required' then raise; end if;
end;
$$;

do $$
begin
  perform grant_role('00000000-0000-0000-0000-00000000000b', 'witch');
  raise exception 'only admins grant roles';
exception when raise_exception then
  if sqlerrm <> 'admins only' then raise; end if;
end;
$$;

-- ---------- the witch grants and revokes ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select grant_role('00000000-0000-0000-0000-00000000000b', 'witch');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
begin
  perform apply_changes('[{"op": "upsert", "kind": "task", "id": "b1", "data": {"id": "b1", "title": "своё", "status": "open"}}]');
  assert (select count(*) from entities where kind = 'task') = 1, 'a new witch sees only her own tasks';
  assert jsonb_array_length(grimoire_backlog()) = 1, 'her backlog';
end;
$$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select revoke_role('00000000-0000-0000-0000-00000000000b', 'witch');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
begin
  assert (select count(*) from entities where kind = 'task') = 0, 'grimoire hidden after the role is revoked';
  assert (select count(*) from entities where kind = 'mold') = 1, 'workshop untouched';
end;
$$;

-- ---------- the data itself stays ----------
reset role;
do $$
begin
  assert (select count(*) from entities where owner_id = '00000000-0000-0000-0000-00000000000b' and kind = 'task') = 1,
    'revoking hides the grimoire but keeps it';
  -- The public candle page still works through its security definer function.
  assert (candle_public('witch', 'S-0001')->>'found')::boolean = false, 'candle_public answers';
end;
$$;

\echo 'grimoire access rules: ok'

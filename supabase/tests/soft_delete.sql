-- Migration 0010: a deleted candle stays in the database but is hidden everywhere. Runs after agent_keys.sql.
\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

do $$
declare
  rid uuid := '00000000-0000-0000-0000-0000000000d1';
begin
  perform apply_changes(jsonb_build_array(
    jsonb_build_object('op', 'upsert', 'kind', 'candle', 'id', 'S-0901', 'data', '{"id": "S-0901", "name": "Свеча"}'::jsonb),
    jsonb_build_object('op', 'upsert', 'kind', 'review', 'id', rid, 'data', jsonb_build_object('candleId', 'S-0901'))
  ));
  assert (candle_public('witch', 'S-0901')->>'found')::boolean, 'a live candle is public';

  perform apply_changes(jsonb_build_array(
    jsonb_build_object('op', 'upsert', 'kind', 'candle', 'id', 'S-0901', 'data', '{"id": "S-0901", "name": "Свеча"}'::jsonb, 'deleteDate', '2026-11-01T10:00:00Z'),
    jsonb_build_object('op', 'upsert', 'kind', 'review', 'id', rid, 'data', jsonb_build_object('candleId', 'S-0901'), 'deleteDate', '2026-11-01T10:00:00Z')
  ));
  assert (select delete_date from entities where kind = 'candle' and id = 'S-0901') = '2026-11-01T10:00:00Z', 'the candle keeps its row and date';
  assert (select delete_date from reviews where id = rid) = '2026-11-01T10:00:00Z', 'the review keeps its row and date';
  assert not (candle_public('witch', 'S-0901')->>'found')::boolean, 'a deleted candle is not public';

  begin
    perform submit_review('witch', jsonb_build_object('id', gen_random_uuid(), 'candleId', 'S-0901'));
    raise exception 'a review of a deleted candle must fail';
  exception when raise_exception then
    if sqlerrm <> 'unknown candle' then raise; end if;
  end;

  -- A device that hasn't heard of the deletion can't bring the row back or erase it.
  perform apply_changes(jsonb_build_array(jsonb_build_object('op', 'upsert', 'kind', 'candle', 'id', 'S-0901', 'data', '{"id": "S-0901", "name": "Новое"}'::jsonb)));
  assert (select delete_date from entities where kind = 'candle' and id = 'S-0901') is not null, 'an upsert does not bring it back';
  perform apply_changes(jsonb_build_array(jsonb_build_object('op', 'delete', 'kind', 'candle', 'id', 'S-0901')));
  assert exists (select 1 from entities where kind = 'candle' and id = 'S-0901'), 'a plain delete does not erase it';

  -- An undone step still removes a live row outright.
  perform apply_changes(jsonb_build_array(jsonb_build_object('op', 'upsert', 'kind', 'candle', 'id', 'S-0902', 'data', '{"id": "S-0902"}'::jsonb)));
  perform apply_changes(jsonb_build_array(jsonb_build_object('op', 'delete', 'kind', 'candle', 'id', 'S-0902')));
  assert not exists (select 1 from entities where kind = 'candle' and id = 'S-0902'), 'a plain delete removes a live row';
end;
$$;

reset role;

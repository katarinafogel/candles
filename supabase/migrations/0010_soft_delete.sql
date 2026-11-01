-- Удаление свечей и подсвечников: строка остаётся в базе с датой удаления, но приложению,
-- странице свечи по QR и форме отзыва она больше не видна. Отзывы удалённой свечи — так же.

alter table public.entities add column if not exists delete_date timestamptz;
alter table public.reviews add column if not exists delete_date timestamptz;

-- A change may carry deleteDate: the row is saved one last time and hidden. Without it an upsert
-- leaves the date alone, so a device that hasn't heard of the deletion can't bring the row back,
-- and a plain delete (an undone step) doesn't touch a row that is already hidden.
create or replace function public.apply_changes(p_changes jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  c jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 2000 then
    raise exception 'bad changes';
  end if;

  for c in select * from jsonb_array_elements(p_changes) loop
    if c->>'kind' = 'review' then
      if c->>'op' = 'delete' then
        delete from reviews where id = (c->>'id')::uuid and owner_id = uid and delete_date is null;
      else
        insert into reviews (id, owner_id, candle_id, data, source, read, delete_date)
        values (
          (c->>'id')::uuid, uid, c->'data'->>'candleId', c->'data',
          coalesce(c->'data'->>'source', 'manual'), coalesce((c->'data'->>'read')::boolean, false),
          (c->>'deleteDate')::timestamptz
        )
        on conflict (id) do update
          set candle_id = excluded.candle_id, data = excluded.data, read = excluded.read,
              delete_date = coalesce(reviews.delete_date, excluded.delete_date)
          where reviews.owner_id = uid;
      end if;
    elsif c->>'op' = 'delete' then
      delete from entities where owner_id = uid and kind = c->>'kind' and id = c->>'id' and delete_date is null;
    else
      insert into entities (owner_id, kind, id, data, updated_at, delete_date)
      values (uid, c->>'kind', c->>'id', c->'data', now(), (c->>'deleteDate')::timestamptz)
      on conflict (owner_id, kind, id) do update
        set data = excluded.data, updated_at = now(),
            delete_date = coalesce(entities.delete_date, excluded.delete_date);
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_changes(jsonb) from public, anon;
grant execute on function public.apply_changes(jsonb) to authenticated;

create or replace function public.candle_public(p_slug text, p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_master text;
  v_candle jsonb;
  v_instruction text;
begin
  select user_id, name into v_owner, v_master from profiles where slug = lower(p_slug);
  if v_owner is null then
    return jsonb_build_object('found', false);
  end if;
  select data into v_candle from entities
    where owner_id = v_owner and kind = 'candle' and id = p_id and delete_date is null;
  if v_candle is null then
    return jsonb_build_object('found', false, 'master', v_master);
  end if;
  select data->>'text' into v_instruction
    from entities where owner_id = v_owner and kind = 'instruction' and id = v_candle->>'instructionId';
  return jsonb_build_object(
    'found', true,
    'master', v_master,
    'name', v_candle->>'name',
    'instruction', coalesce(v_instruction, '')
  );
end;
$$;

revoke all on function public.candle_public(text, text) from public;
grant execute on function public.candle_public(text, text) to anon, authenticated;

create or replace function public.submit_review(p_slug text, p_review jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_id uuid;
  v_candle text := p_review->>'candleId';
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
$$;

revoke all on function public.submit_review(text, jsonb) from public;
grant execute on function public.submit_review(text, jsonb) to anon, authenticated;

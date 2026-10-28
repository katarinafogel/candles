-- Отзыв: поле «Как с вами связаться» и ответ на вопрос «Хотите помогать тестировать свечи дальше?».
-- Ответ тестировщика пока лежит в самом отзыве (data.tester): мастер видит его рядом с отзывом.

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
     or not exists (select 1 from entities where owner_id = v_owner and kind = 'candle' and id = v_candle) then
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

-- The recipient answers the tester question right after sending a review, by that review's UUID
-- (known only to their phone). Once per review, within a day; ароматы only from the fixed list.
create or replace function public.submit_tester(p_slug text, p_review_id uuid, p_tester jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_clean jsonb;
  notes constant jsonb := '["цветочный", "ягодный/фруктовый", "древесный", "пряный", "сладкий", "гурманский", "парфюм", "озон/свежесть", "зеленый", "пудровый"]';
  colors constant jsonb := '["белый", "молочный", "бежевый", "розовый", "красный", "бордовый", "оранжевый", "жёлтый", "зелёный", "голубой", "синий", "фиолетовый", "серый", "чёрный", "золотой"]';
begin
  if pg_column_size(p_tester) > 8192 then
    raise exception 'answer too large';
  end if;
  select user_id into v_owner from profiles where slug = lower(p_slug);
  if v_owner is null then
    raise exception 'unknown master';
  end if;
  if not exists (
    select 1 from reviews
    where id = p_review_id and owner_id = v_owner and source = 'qr'
      and created_at > now() - interval '1 day' and not (data ? 'tester')
  ) then
    raise exception 'unknown review';
  end if;
  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'wants', case when jsonb_typeof(p_tester->'wants') = 'boolean' then p_tester->'wants' end,
    'notes', (select jsonb_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(p_tester->'notes') = 'array' then p_tester->'notes' else '[]' end) x where notes ? x),
    'colors', (select jsonb_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(p_tester->'colors') = 'array' then p_tester->'colors' else '[]' end) x where colors ? x),
    'comment', nullif(left(p_tester->>'comment', 2000), ''),
    'at', now()
  ));
  if not (v_clean ? 'wants') then
    raise exception 'bad answer';
  end if;
  update reviews set data = data || jsonb_build_object('tester', v_clean), read = false where id = p_review_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_tester(text, uuid, jsonb) from public;
grant execute on function public.submit_tester(text, uuid, jsonb) to anon, authenticated;

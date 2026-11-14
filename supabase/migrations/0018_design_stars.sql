-- «Понравился ли дизайн?» is now five stars instead of a 1–10 slider: the server takes 1–5, and the
-- ratings given on the old scale are halved (8 → 4).
do $$
declare
  d text := pg_get_functiondef('public.submit_review(text,jsonb)'::regprocedure);
  was constant text := '''design'', _num(p_review->''design'', 1, 10, 0)';
begin
  if position(was in d) = 0 then
    raise exception 'submit_review: design bound not found';
  end if;
  execute replace(d, was, '''design'', _num(p_review->''design'', 1, 5, 0)');
end
$$;

update reviews
set data = jsonb_set(data, '{design}', to_jsonb(greatest(1, round((data->>'design')::numeric / 2))::int))
where data ? 'design' and (data->>'design')::numeric > 5;

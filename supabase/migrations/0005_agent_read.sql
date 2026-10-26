-- The agent server reads through this function instead of the table: the owner's grimoire rows
-- and, from the workshop, only people's names (for names on tasks). Nothing else of the workshop.
-- service_role gets no privileges on the tables themselves.
create or replace function public.grimoire_rows_as(p_owner uuid)
returns table (kind text, id text, data jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_owner is null or not exists (select 1 from user_roles where user_id = p_owner and role = 'witch') then
    raise exception 'witch role required';
  end if;
  return query
    select e.kind, e.id, e.data from entities e
    where e.owner_id = p_owner and is_grimoire_row(e.kind, e.id)
    union all
    select e.kind, e.id, jsonb_build_object('id', e.id, 'name', e.data->>'name') from entities e
    where e.owner_id = p_owner and e.kind = 'person';
end;
$$;

revoke all on function public.grimoire_rows_as(uuid) from public, anon, authenticated;
grant execute on function public.grimoire_rows_as(uuid) to service_role;

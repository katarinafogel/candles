-- Just enough of Supabase for the migrations to run on a plain Postgres in CI:
-- the API roles, auth.users and auth.uid() read from the JWT claim like PostgREST sets it.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema public to anon, authenticated, service_role;
-- In Supabase the server role can read and write every table the migrations create.
alter default privileges in schema public grant all on tables to service_role;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),  -- the witch, the only master when 0002 runs
  ('00000000-0000-0000-0000-00000000000b');  -- a master who joins later

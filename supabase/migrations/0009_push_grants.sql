-- The push function works as service_role, which in this project gets no table rights by default.
grant select, delete on public.push_subscriptions to service_role;
grant select, insert, update on public.push_state to service_role;
grant select, update on public.push_config to service_role;

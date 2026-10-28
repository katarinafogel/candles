-- Run once after deploying grimoire-push (not a migration: it needs pg_cron and pg_net and the
-- project's own URL). Every 15 minutes the function looks what is due for whom and sends it.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('grimoire-push') where exists (select 1 from cron.job where jobname = 'grimoire-push');
select cron.schedule(
  'grimoire-push',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://ludyqmihcsdudqqdbohh.supabase.co/functions/v1/grimoire-push/tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', (select cron_key from public.push_config where id = 1)),
    body := '{}'::jsonb
  )
  $$
);

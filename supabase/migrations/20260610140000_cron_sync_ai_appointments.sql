-- Cron: sincroniza automaticamente os pedidos de agendamento da IA (WhatsApp)
-- do backend externo para a tabela ai_appointment_requests, a cada 2 minutos.
-- Assim os pedidos aparecem sozinhos na Agenda, sem ninguém clicar "Sincronizar".
--
-- Pré-requisitos (já cobertos por migration anterior):
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
-- SEGREDO: a service_role key NÃO fica no SQL versionado. Ela é lida do Vault.
-- Antes de o cron funcionar, cadastre a chave no Vault UMA vez (SQL Editor):
--
--   select vault.create_secret(
--     '<SUA_SERVICE_ROLE_KEY>',
--     'service_role_key',
--     'Service role key para chamadas internas de cron'
--   );
--
-- (Se já existir um secret 'service_role_key', não precisa recriar.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior com o mesmo nome (idempotente em re-deploys).
select cron.unschedule('sync-ai-appointments-every-2min')
where exists (
  select 1 from cron.job where jobname = 'sync-ai-appointments-every-2min'
);

-- Agenda: a cada 2 minutos chama a Edge Function sync-ai-appointments.
-- A função internamente itera as clínicas e puxa os pendentes do backend da IA.
select cron.schedule(
  'sync-ai-appointments-every-2min',
  '*/2 * * * *',
  $$
  select net.http_post(
    url     := 'https://fwyulywxhjyxdreeuqna.supabase.co/functions/v1/sync-ai-appointments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'service_role_key' limit 1
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Para remover depois, se precisar:
--   select cron.unschedule('sync-ai-appointments-every-2min');

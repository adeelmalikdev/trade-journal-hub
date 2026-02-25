ALTER TABLE public.broker_accounts
  ADD COLUMN IF NOT EXISTS broker_server text,
  ADD COLUMN IF NOT EXISTS meta_api_account_id text;
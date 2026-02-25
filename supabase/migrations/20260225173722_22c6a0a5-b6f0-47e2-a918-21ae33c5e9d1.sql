
-- Add sync scheduling columns to broker_accounts
ALTER TABLE public.broker_accounts
  ADD COLUMN IF NOT EXISTS next_sync_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sync_error text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sync_in_progress boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- Set initial next_sync_at for existing active accounts
UPDATE public.broker_accounts
SET next_sync_at = now() + (sync_frequency * interval '1 minute')
WHERE is_active = true AND next_sync_at IS NULL;

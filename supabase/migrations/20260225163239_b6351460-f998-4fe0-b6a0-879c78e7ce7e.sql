
-- Extend broker_accounts with new fields
ALTER TABLE public.broker_accounts
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS api_key_masked VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS connection_status VARCHAR(20) NOT NULL DEFAULT 'connected',
  ADD COLUMN IF NOT EXISTS sync_frequency INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT NULL;

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_account_id UUID NOT NULL REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  trades_synced INTEGER DEFAULT 0,
  error_message TEXT DEFAULT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs" ON public.sync_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sync logs" ON public.sync_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own sync logs" ON public.sync_logs FOR DELETE USING (auth.uid() = user_id);

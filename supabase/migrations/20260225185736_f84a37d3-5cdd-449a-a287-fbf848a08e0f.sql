-- Enable realtime for broker_accounts and sync_logs (trades already enabled)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_accounts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
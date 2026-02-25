
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS broker_trade_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS trades_user_broker_trade_unique 
ON public.trades (user_id, broker_trade_id) 
WHERE broker_trade_id IS NOT NULL;

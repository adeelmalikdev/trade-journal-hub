ALTER TABLE public.trades ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE public.trades ADD COLUMN emotion VARCHAR(50);
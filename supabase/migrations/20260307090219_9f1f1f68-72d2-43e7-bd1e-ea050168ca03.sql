ALTER TABLE public.saldo_mensal ADD COLUMN IF NOT EXISTS valor_guardado numeric NOT NULL DEFAULT 0;
ALTER TABLE public.saldo_mensal ADD COLUMN IF NOT EXISTS valor_gasto numeric NOT NULL DEFAULT 0;
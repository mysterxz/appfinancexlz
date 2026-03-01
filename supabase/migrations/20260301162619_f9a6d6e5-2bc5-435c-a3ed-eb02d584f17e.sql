
-- Add saldo_inicial, saldo_final, and locked columns to saldo_mensal
ALTER TABLE public.saldo_mensal
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_final numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

-- Backfill existing records: saldo_final = valor, saldo_inicial = 0
UPDATE public.saldo_mensal SET saldo_final = valor WHERE saldo_final = 0 AND valor != 0;

-- Update locked for already closed records
UPDATE public.saldo_mensal SET locked = true WHERE status IN ('guardado', 'gasto');

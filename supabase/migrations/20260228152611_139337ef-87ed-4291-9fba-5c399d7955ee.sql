
-- Tabela saldo_mensal
CREATE TABLE public.saldo_mensal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  total_receitas NUMERIC NOT NULL DEFAULT 0,
  total_despesas NUMERIC NOT NULL DEFAULT 0,
  valor NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  nome_caixinha TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes, ano)
);

-- Enable RLS
ALTER TABLE public.saldo_mensal ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage own saldo_mensal"
  ON public.saldo_mensal
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_saldo_mensal_updated_at
  BEFORE UPDATE ON public.saldo_mensal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

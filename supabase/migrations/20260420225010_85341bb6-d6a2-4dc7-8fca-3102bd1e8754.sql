-- Adicionar colunas necessárias para recomendações preventivas
ALTER TABLE public.lembretes_preventivos
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS exame text,
  ADD COLUMN IF NOT EXISTS sistema text,
  ADD COLUMN IF NOT EXISTS prioridade text,
  ADD COLUMN IF NOT EXISTS data_recomendada date;

-- Tornar tipo_exame e data_proximo nullable (migração para o novo schema mais flexível)
ALTER TABLE public.lembretes_preventivos
  ALTER COLUMN tipo_exame DROP NOT NULL,
  ALTER COLUMN data_proximo DROP NOT NULL;

-- Índice único para upsert por (auth_user_id, exame)
CREATE UNIQUE INDEX IF NOT EXISTS lembretes_preventivos_user_exame_idx
  ON public.lembretes_preventivos (auth_user_id, exame)
  WHERE auth_user_id IS NOT NULL AND exame IS NOT NULL;

-- Habilitar RLS
ALTER TABLE public.lembretes_preventivos ENABLE ROW LEVEL SECURITY;

-- Política: usuário gerencia seus próprios lembretes
DROP POLICY IF EXISTS "user owns lembretes" ON public.lembretes_preventivos;
CREATE POLICY "user owns lembretes"
  ON public.lembretes_preventivos
  FOR ALL
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);
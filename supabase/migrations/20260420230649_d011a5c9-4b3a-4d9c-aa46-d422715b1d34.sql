-- Tabela de subscriptions de push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  ultimo_score_push timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users own subscriptions" ON public.push_subscriptions;
CREATE POLICY "users own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Adicionar colunas em lembretes_preventivos
ALTER TABLE public.lembretes_preventivos
  ADD COLUMN IF NOT EXISTS push_enviado timestamptz;

-- Adicionar colunas em consultas_agendadas
ALTER TABLE public.consultas_agendadas
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS push_enviado timestamptz;

-- Habilitar RLS em consultas_agendadas (estava sem)
ALTER TABLE public.consultas_agendadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user owns consultas" ON public.consultas_agendadas;
CREATE POLICY "user owns consultas"
  ON public.consultas_agendadas
  FOR ALL
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);
CREATE TABLE public.clinicas_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('clinica', 'laboratorio', 'medico')),
  telefone text,
  whatsapp text,
  especialidade text,
  sistemas text[] DEFAULT '{}',
  whatsapp_valido boolean,
  verificado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.clinicas_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own clinicas"
  ON public.clinicas_usuario FOR ALL
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE INDEX idx_clinicas_user ON public.clinicas_usuario (auth_user_id);
CREATE INDEX idx_clinicas_whatsapp ON public.clinicas_usuario (whatsapp) WHERE whatsapp IS NOT NULL;
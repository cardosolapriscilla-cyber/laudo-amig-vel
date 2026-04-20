-- Garantir FK em auth_user_id (se ainda não houver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'consultas_agendadas'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'consultas_agendadas_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.consultas_agendadas
      ADD CONSTRAINT consultas_agendadas_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Índice para busca por data + usuário (usado pelo push-scheduler)
CREATE INDEX IF NOT EXISTS idx_consultas_data
  ON public.consultas_agendadas (data_consulta, auth_user_id);
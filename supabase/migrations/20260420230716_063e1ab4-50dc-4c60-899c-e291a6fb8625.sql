-- whatsapp_users
ALTER TABLE public.whatsapp_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user owns whatsapp_user" ON public.whatsapp_users;
CREATE POLICY "user owns whatsapp_user"
  ON public.whatsapp_users
  FOR ALL
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- whatsapp_exames
ALTER TABLE public.whatsapp_exames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user owns whatsapp_exames" ON public.whatsapp_exames;
CREATE POLICY "user owns whatsapp_exames"
  ON public.whatsapp_exames
  FOR ALL
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- whatsapp_mensagens (sem auth_user_id direto; ligado via whatsapp_users.user_id)
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user owns whatsapp_mensagens" ON public.whatsapp_mensagens;
CREATE POLICY "user owns whatsapp_mensagens"
  ON public.whatsapp_mensagens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_users wu
      WHERE wu.id = whatsapp_mensagens.user_id
        AND wu.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.whatsapp_users wu
      WHERE wu.id = whatsapp_mensagens.user_id
        AND wu.auth_user_id = auth.uid()
    )
  );

-- dicas_enviadas (mesmo padrão)
ALTER TABLE public.dicas_enviadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user owns dicas" ON public.dicas_enviadas;
CREATE POLICY "user owns dicas"
  ON public.dicas_enviadas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_users wu
      WHERE wu.id = dicas_enviadas.user_id
        AND wu.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.whatsapp_users wu
      WHERE wu.id = dicas_enviadas.user_id
        AND wu.auth_user_id = auth.uid()
    )
  );

-- shared_briefings: dono gerencia, qualquer um com token pode ler
ALTER TABLE public.shared_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner manages briefings" ON public.shared_briefings;
CREATE POLICY "owner manages briefings"
  ON public.shared_briefings
  FOR ALL
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "public read by token" ON public.shared_briefings;
CREATE POLICY "public read by token"
  ON public.shared_briefings
  FOR SELECT
  USING (true);
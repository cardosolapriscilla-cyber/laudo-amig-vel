-- Drop overly permissive public read on shared_briefings
DROP POLICY IF EXISTS "public read by token" ON public.shared_briefings;

-- Fix perfis: add WITH CHECK to enforce ownership on INSERT/UPDATE
DROP POLICY IF EXISTS "user owns perfil" ON public.perfis;
CREATE POLICY "user owns perfil"
  ON public.perfis FOR ALL
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Fix exames: add WITH CHECK as well (was missing)
DROP POLICY IF EXISTS "user owns exames" ON public.exames;
CREATE POLICY "user owns exames"
  ON public.exames FOR ALL
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);
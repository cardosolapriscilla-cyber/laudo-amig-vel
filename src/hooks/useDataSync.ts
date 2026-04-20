import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useExamStore } from "@/stores/examStore";
import type { Exame, ResultadoLaudo, ResultadoEvolutivo } from "@/types/health";

/**
 * Sincroniza dados do localStorage <-> Supabase quando o usuário loga.
 * - Faz pull dos exames/perfil do servidor
 * - Migra exames locais não-sincronizados (primeiro login)
 */
export function useDataSync() {
  const { user, loading } = useAuth();
  const migrated = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (migrated.current === user.id) return;
    migrated.current = user.id;

    (async () => {
      try {
        const localState = useExamStore.getState();

        // 1. Buscar perfil remoto
        const { data: perfilRemoto } = await supabase
          .from("perfis")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (perfilRemoto) {
          useExamStore.getState().setPerfil({
            nome: perfilRemoto.nome || "",
            dataNascimento: perfilRemoto.data_nascimento || "",
            sexoBiologico: (perfilRemoto.sexo_biologico as any) || "",
            condicoes: perfilRemoto.condicoes || [],
            historicoFamiliar: perfilRemoto.historico_familiar || "",
          });
        } else if (localState.perfil.nome) {
          // Upsert perfil local p/ servidor
          await supabase.from("perfis").upsert({
            auth_user_id: user.id,
            nome: localState.perfil.nome,
            data_nascimento: localState.perfil.dataNascimento || null,
            sexo_biologico: localState.perfil.sexoBiologico || null,
            condicoes: localState.perfil.condicoes,
            historico_familiar: localState.perfil.historicoFamiliar || null,
          });
        }

        // 2. Buscar exames remotos
        const { data: examesRemotos } = await supabase
          .from("exames")
          .select("*")
          .eq("auth_user_id", user.id)
          .order("created_at", { ascending: false });

        const remotosMapeados: Exame[] = (examesRemotos || []).map((e) => ({
          id: e.id,
          tipo: e.tipo as any,
          nome: e.nome,
          data: e.data || new Date(e.created_at!).toISOString().split("T")[0],
          laboratorio: e.laboratorio || "Não informado",
          textoOriginal: e.texto_original,
          resumo: e.resumo || undefined,
          sistema: e.sistema || undefined,
          resultado: (e.resultado_json as unknown as ResultadoLaudo) || undefined,
          resultadoEvolutivo: (e.resultado_evolutivo_json as unknown as ResultadoEvolutivo) || undefined,
        }));

        // 3. Migrar exames locais que não estão no servidor
        const remoteIds = new Set(remotosMapeados.map((e) => e.id));
        const localOnly = localState.exames.filter((e) => !remoteIds.has(e.id));

        if (localOnly.length > 0) {
          const inserts = localOnly.map((e) => ({
            id: e.id,
            auth_user_id: user.id,
            nome: e.nome,
            tipo: e.tipo,
            data: e.data || null,
            laboratorio: e.laboratorio || null,
            sistema: e.sistema || null,
            texto_original: e.textoOriginal,
            resumo: e.resumo || null,
            resultado_json: (e.resultado as any) || null,
            resultado_evolutivo_json: (e.resultadoEvolutivo as any) || null,
          }));
          const { error: insertErr } = await supabase.from("exames").insert(inserts);
          if (insertErr) console.error("Erro ao migrar exames:", insertErr);
        }

        // 4. Mesclar (servidor + locais migrados) no store
        const merged = [...localOnly, ...remotosMapeados].sort((a, b) =>
          (b.data || "").localeCompare(a.data || "")
        );
        useExamStore.setState({ exames: merged });
      } catch (err) {
        console.error("Erro no sync:", err);
      }
    })();
  }, [user, loading]);
}

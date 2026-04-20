import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Exame, PerfilSaude, Checkin, ResultadoScore } from "@/types/health";
import { supabase } from "@/integrations/supabase/client";

interface ExamStore {
  exames: Exame[];
  perfil: PerfilSaude;
  checkins: Checkin[];
  scores: ResultadoScore[];
  addExame: (exame: Exame) => void;
  updateExame: (id: string, updates: Partial<Exame>) => void;
  setPerfil: (perfil: Partial<PerfilSaude>) => void;
  addCheckin: (checkin: Checkin) => void;
  addScore: (score: ResultadoScore) => void;
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function syncExameToSupabase(userId: string, exame: Exame) {
  const { error } = await supabase.from("exames").upsert({
    id: exame.id,
    auth_user_id: userId,
    nome: exame.nome,
    tipo: exame.tipo,
    data: exame.data || null,
    laboratorio: exame.laboratorio || null,
    sistema: exame.sistema || null,
    texto_original: exame.textoOriginal,
    resumo: exame.resumo || null,
    resultado_json: (exame.resultado as any) || null,
    resultado_evolutivo_json: (exame.resultadoEvolutivo as any) || null,
  });
  if (error) console.error("Erro ao sincronizar exame:", error);
}

// Migra dados do storage antigo para o novo
if (typeof window !== "undefined") {
  const old = localStorage.getItem("laudo-amigavel-storage");
  if (old && !localStorage.getItem("nauta-storage")) {
    localStorage.setItem("nauta-storage", old);
    localStorage.removeItem("laudo-amigavel-storage");
  }
}

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      exames: [],
      perfil: {
        nome: "",
        dataNascimento: "",
        sexoBiologico: "",
        condicoes: [],
        historicoFamiliar: "",
      },
      checkins: [],
      scores: [],
      addExame: (exame) => {
        set((state) => ({ exames: [exame, ...state.exames] }));
        getUserId().then((uid) => {
          if (uid) syncExameToSupabase(uid, exame);
        });
      },
      updateExame: (id, updates) => {
        set((state) => ({
          exames: state.exames.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        }));
        const updated = get().exames.find((e) => e.id === id);
        if (updated) {
          getUserId().then((uid) => {
            if (uid) syncExameToSupabase(uid, updated);
          });
        }
      },
      setPerfil: (updates) => {
        set((state) => ({ perfil: { ...state.perfil, ...updates } }));
        const next = get().perfil;
        getUserId().then((uid) => {
          if (!uid) return;
          supabase.from("perfis").upsert({
            auth_user_id: uid,
            nome: next.nome || null,
            data_nascimento: next.dataNascimento || null,
            sexo_biologico: next.sexoBiologico || null,
            condicoes: next.condicoes,
            historico_familiar: next.historicoFamiliar || null,
          }, { onConflict: "auth_user_id" }).then(({ error }) => {
            if (error) console.error("Erro ao sincronizar perfil:", error);
          });
        });
      },
      addCheckin: (checkin) =>
        set((state) => ({ checkins: [checkin, ...state.checkins] })),
      addScore: (score) =>
        set((state) => ({ scores: [score, ...state.scores] })),
    }),
    {
      name: "nauta-storage",
    }
  )
);

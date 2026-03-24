import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Exame, PerfilSaude, Checkin, ResultadoScore } from "@/types/health";

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

// Mock score for demo (uncomment to enable):
// const DEMO_SCORE: ResultadoScore = {
//   score_geral: 72,
//   tendencia: "primeiro_registro",
//   frase_contexto: "Seus exames clínicos estão bem — sono merece atenção.",
//   pilares: [
//     { nome: "Exames clínicos", score: 82, fonte: "objetivo", status: "bom", detalhe: "Hemograma e lipídeos dentro da faixa" },
//     { nome: "Sono", score: 55, fonte: "autodeclarado", status: "atencao", detalhe: "5-6h por noite, qualidade regular" },
//     { nome: "Estresse", score: 68, fonte: "autodeclarado", status: "bom", detalhe: "Nível moderado de estresse" },
//     { nome: "Atividade física", score: 75, fonte: "autodeclarado", status: "bom", detalhe: "150-300 min/semana" },
//   ],
//   confiabilidade: { pilares_preenchidos: 4, total_pilares: 6, nivel: "media", mensagem: "Faltam alimentação e adesão preventiva" },
//   comparacao_populacional: null,
//   proximo_passo: "Tente dormir 7h por noite nas próximas 2 semanas.",
// };

export const useExamStore = create<ExamStore>()(
  persist(
    (set) => ({
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
      addExame: (exame) =>
        set((state) => ({ exames: [exame, ...state.exames] })),
      updateExame: (id, updates) =>
        set((state) => ({
          exames: state.exames.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      setPerfil: (updates) =>
        set((state) => ({ perfil: { ...state.perfil, ...updates } })),
      addCheckin: (checkin) =>
        set((state) => ({ checkins: [checkin, ...state.checkins] })),
      addScore: (score) =>
        set((state) => ({ scores: [score, ...state.scores] })),
    }),
    {
      name: "laudo-amigavel-storage",
    }
  )
);

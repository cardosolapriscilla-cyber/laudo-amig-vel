import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Exame, PerfilSaude } from "@/types/health";

interface ExamStore {
  exames: Exame[];
  perfil: PerfilSaude;
  addExame: (exame: Exame) => void;
  updateExame: (id: string, updates: Partial<Exame>) => void;
  setPerfil: (perfil: Partial<PerfilSaude>) => void;
}

const MOCK_EXAMES: Exame[] = [
  {
    id: "1",
    tipo: "sangue",
    nome: "Hemograma Completo",
    data: "2025-01-15",
    laboratorio: "Lab São Lucas",
    textoOriginal: "Hemoglobina: 14.2 g/dL (ref: 12.0-16.0)\nHematócrito: 42% (ref: 36-46%)\nLeucócitos: 7.800/mm³ (ref: 4.000-11.000)\nPlaquetas: 245.000/mm³ (ref: 150.000-400.000)\nGlicemia jejum: 92 mg/dL (ref: 70-99)\nColesterol Total: 198 mg/dL (ref: <200)\nLDL: 128 mg/dL (ref: <130)\nHDL: 52 mg/dL (ref: >40)\nTriglicerídeos: 142 mg/dL (ref: <150)",
    resumo: "Resultados dentro da normalidade",
  },
  {
    id: "2",
    tipo: "sangue",
    nome: "Hemograma Completo",
    data: "2024-07-20",
    laboratorio: "Lab São Lucas",
    textoOriginal: "Hemoglobina: 13.8 g/dL (ref: 12.0-16.0)\nHematócrito: 41% (ref: 36-46%)\nLeucócitos: 8.200/mm³ (ref: 4.000-11.000)\nPlaquetas: 230.000/mm³ (ref: 150.000-400.000)\nGlicemia jejum: 98 mg/dL (ref: 70-99)\nColesterol Total: 215 mg/dL (ref: <200)\nLDL: 145 mg/dL (ref: <130)\nHDL: 45 mg/dL (ref: >40)\nTriglicerídeos: 168 mg/dL (ref: <150)",
    resumo: "Colesterol e triglicerídeos elevados",
  },
  {
    id: "3",
    tipo: "imagem",
    nome: "Raio-X Tórax",
    data: "2024-11-03",
    laboratorio: "Clínica Imagem",
    textoOriginal: "Campos pulmonares limpos, sem consolidações ou infiltrados. Silhueta cardíaca dentro dos limites da normalidade. Seios costofrênicos livres. Traqueia centrada. Estruturas ósseas sem alterações.",
    resumo: "Sem alterações significativas",
  },
];

export const useExamStore = create<ExamStore>()(
  persist(
    (set) => ({
      exames: MOCK_EXAMES,
      perfil: {
        nome: "Ana",
        dataNascimento: "1990-05-12",
        sexoBiologico: "feminino",
        condicoes: [],
        historicoFamiliar: "",
      },
      addExame: (exame) =>
        set((state) => ({ exames: [exame, ...state.exames] })),
      updateExame: (id, updates) =>
        set((state) => ({
          exames: state.exames.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      setPerfil: (updates) =>
        set((state) => ({ perfil: { ...state.perfil, ...updates } })),
    }),
    {
      name: "laudo-amigavel-storage",
    }
  )
);

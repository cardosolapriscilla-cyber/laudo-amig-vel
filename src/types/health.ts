export interface Achado {
  parametro: string;
  status: "normal" | "atencao" | "acompanhamento";
  explicacao_simples: string;
  analogia: string;
  pergunta_medico?: string;
}

export interface GlossarioItem {
  termo: string;
  definicao: string;
}

export interface ResultadoExplicador {
  tipo_exame: string;
  achados: Achado[];
  resumo_geral: string;
  glossario: GlossarioItem[];
  perguntas_para_medico: string[];
}

export interface ParametroEvolutivo {
  nome: string;
  valores: {
    data: string;
    valor: number;
    unidade: string;
    referencia_min: number;
    referencia_max: number;
  }[];
  variacao_percentual: number;
  tendencia: "melhora" | "estavel" | "atencao" | "piora";
  comentario: string;
}

export interface ResultadoEvolutivo {
  tipo_exame: string;
  periodo: { inicio: string; fim: string };
  narrativa_geral: string;
  parametros: ParametroEvolutivo[];
  alertas: string[];
  proximo_passo: string;
}

export type TipoExame = "sangue" | "imagem" | "outros";

export interface Exame {
  id: string;
  tipo: TipoExame;
  nome: string;
  data: string;
  laboratorio: string;
  textoOriginal: string;
  resultado?: ResultadoExplicador;
  resumo?: string;
}

export interface PerfilSaude {
  nome: string;
  dataNascimento: string;
  sexoBiologico: "masculino" | "feminino" | "";
  condicoes: string[];
  historicoFamiliar: string;
}

export type TipoExame = "sangue" | "imagem" | "outros";

export type SistemaExame =
  | "Cardiovascular"
  | "Metabólico"
  | "Hepatobiliar"
  | "Renal"
  | "Endócrino"
  | "Hematológico"
  | "Respiratório"
  | "Musculoesquelético"
  | "Neurológico"
  | "Outro";

// --- Explicador v2 ---

export interface Achado {
  parametro: string;
  status: "normal" | "atencao" | "acompanhamento";
  valor?: string | null;
  referencia?: string | null;
  tipo_visualizacao?: "regua" | "trilha_discreta" | "texto";
  estado_discreto?: {
    opcoes: string[];
    atual: string;
  } | null;
  explicacao_simples: string;
  analogia: string;
  pergunta_medico?: string;
}

export interface GlossarioItem {
  termo: string;
  definicao: string;
}

export interface ResultadoExplicador {
  origem?: {
    laboratorio?: string | null;
    data_coleta?: string | null;
    data_emissao?: string | null;
  };
  tipo_exame: string;
  sistema?: SistemaExame;
  resumo_geral: string;
  achados: Achado[];
  glossario: GlossarioItem[];
  perguntas_para_medico: string[];
  alerta_medico?: string | null;
}

// --- Evolutivo v2 ---

export interface ParametroEvolutivo {
  nome: string;
  unidade?: string;
  sistema?: string;
  valores: {
    data: string;
    valor: number;
    laboratorio?: string | null;
    unidade?: string;
    referencia_min?: number | null;
    referencia_max?: number | null;
    dentro_da_faixa?: boolean;
  }[];
  variacao_percentual: number;
  tendencia: "melhora" | "estavel" | "atencao" | "piora";
  comentario: string;
}

export interface EvolucaoOrgao {
  orgao: string;
  trilha: string[];
  historico: {
    data: string;
    estado: string;
    laboratorio?: string | null;
  }[];
}

export interface ResultadoEvolutivo {
  sistema?: string;
  tipo_exame?: string;
  periodo: { inicio: string; fim: string };
  narrativa_geral: string;
  parametros: ParametroEvolutivo[];
  evolucao_orgao?: EvolucaoOrgao[];
  alertas: string[];
  proximo_passo: string;
}

// --- Score de Saúde ---

export interface PilarScore {
  nome: string;
  score: number;
  fonte: "objetivo" | "autodeclarado";
  status: "otimo" | "bom" | "atencao" | "incompleto";
  detalhe: string;
}

export interface ResultadoScore {
  data: string; // ISO date string
  score_geral: number;
  tendencia: "subindo" | "estavel" | "caindo" | "primeiro_registro";
  frase_contexto: string;
  pilares: PilarScore[];
  confiabilidade: {
    pilares_preenchidos: number;
    total_pilares: number;
    nivel: "alta" | "media" | "baixa";
    mensagem: string;
  };
  comparacao_populacional?: string | null;
  proximo_passo: string;
}

// --- Checkin ---

export interface Checkin {
  id: string;
  data: string;
  exame_id: string;
  sono_horas?: string;
  sono_qualidade?: string;
  estresse_pss?: string;
  atividade_minutos?: string;
}

// --- Exame ---

export interface Exame {
  id: string;
  tipo: TipoExame;
  nome: string;
  sistema?: SistemaExame;
  data: string;
  laboratorio: string;
  textoOriginal: string;
  resultado?: ResultadoExplicador;
  resultadoEvolutivo?: ResultadoEvolutivo;
  resumo?: string;
}

// --- Perfil ---

export interface PerfilSaude {
  nome: string;
  dataNascimento: string;
  sexoBiologico: "masculino" | "feminino" | "";
  condicoes: string[];
  historicoFamiliar: string;
}

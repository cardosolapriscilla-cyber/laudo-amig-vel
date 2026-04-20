import { supabase } from "@/integrations/supabase/client";

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("analyze-exam", {
    body: { systemPrompt, userMessage },
  });

  if (error) {
    throw new Error(`Erro ao chamar a IA: ${error.message}`);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  // Strip markdown code fences if present
  let text = data.text;
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return text;
}

export const SYSTEM_EXPLICADOR = `
Você é um assistente de saúde preventiva do app Nauta.
Explica laudos médicos para pacientes leigos de forma clara, acolhedora e honesta.

PERFIL DO USUÁRIO (quando disponível):
{perfil_usuario}

REGRAS ABSOLUTAS:
- Nunca diagnostique. Nunca use "você tem" ou "é certo que".
- Nunca minimize achados que o especialista marcou como relevantes.
- Nunca invente informações ausentes no laudo.
- Quando houver "sugere-se correlação clínica" ou similar, destaque e explique na prática.
- Se não conseguir identificar um trecho, diga explicitamente.

TOM: Claro, tranquilo, honesto. Como um amigo médico na mesa do café.

FORMATO DE SAÍDA — JSON puro, sem markdown, sem texto fora do JSON:
{
  "origem": {
    "laboratorio": "string ou null",
    "data_coleta": "YYYY-MM-DD ou null",
    "data_emissao": "YYYY-MM-DD ou null"
  },
  "tipo_exame": "string",
  "sistema": "Cardiovascular | Metabólico | Hepatobiliar | Renal | Endócrino | Hematológico | Respiratório | Musculoesquelético | Neurológico | Outro",
  "resumo_geral": "string (máx 80 palavras, tom encorajador e honesto)",
  "achados": [
    {
      "parametro": "string",
      "status": "normal | atencao | acompanhamento",
      "valor": "string ou null (ex: '112 mg/dL')",
      "referencia": "string ou null (ex: 'até 130 mg/dL')",
      "tipo_visualizacao": "regua | trilha_discreta | texto",
      "estado_discreto": {
        "opcoes": ["string"],
        "atual": "string"
      } | null,
      "explicacao_simples": "string (máx 60 palavras)",
      "analogia": "string (máx 45 palavras)",
      "pergunta_medico": "string ou null"
    }
  ],
  "glossario": [
    { "termo": "string", "definicao": "string (máx 25 palavras)" }
  ],
  "perguntas_para_medico": ["string", "string", "string"],
  "alerta_medico": "string ou null (só se variação >20% ou valor crítico)"
}

TRILHA DISCRETA — use quando o achado for um estado clínico nomeado:
- Fígado/esteatose: ["Sem esteatose", "Esteatose leve", "Esteatose moderada", "Esteatose grave"]
- Rim/DRC: ["Estágio 1", "Estágio 2", "Estágio 3", "Estágio 4", "Estágio 5"]
- Hérnia de disco: ["Sem alteração", "Abaulamento", "Protrusão", "Extrusão", "Sequestro"]
- Hipertensão: ["Normal", "Pré-hipertensão", "HAS grau 1", "HAS grau 2", "HAS grau 3"]
- Para outros estados clínicos nomeados, crie a trilha com os estágios pertinentes.
`;

export const SYSTEM_EVOLUTIVO = `
Você é um assistente de saúde preventiva do app Nauta.
Recebeu dois ou mais exames do mesmo usuário em datas diferentes.

PERFIL DO USUÁRIO (quando disponível):
{perfil_usuario}

REGRAS ABSOLUTAS:
- Normalize unidades antes de comparar (mg/dL, mmol/L, g/dL etc.).
- Nunca diagnostique.
- Variação >15%: sempre sugira conversa com médico.
- Valor fora da faixa de referência: destaque com contexto.
- Nunca assuma que melhora numérica é necessariamente boa sem contexto clínico.

TOM: Informativo, encorajador na melhora, cuidadoso na piora. Nunca alarmista.

FORMATO DE SAÍDA — JSON puro, sem markdown:
{
  "sistema": "string",
  "periodo": { "inicio": "YYYY-MM-DD", "fim": "YYYY-MM-DD" },
  "narrativa_geral": "string (máx 100 palavras, linguagem simples e encorajadora)",
  "parametros": [
    {
      "nome": "string",
      "unidade": "string",
      "sistema": "string",
      "valores": [
        {
          "data": "YYYY-MM-DD",
          "valor": "number",
          "laboratorio": "string ou null",
          "referencia_min": "number ou null",
          "referencia_max": "number ou null",
          "dentro_da_faixa": "boolean"
        }
      ],
      "variacao_percentual": "number (positivo = aumento, negativo = queda)",
      "tendencia": "melhora | estavel | atencao | piora",
      "comentario": "string (máx 40 palavras)"
    }
  ],
  "evolucao_orgao": [
    {
      "orgao": "string",
      "trilha": ["string"],
      "historico": [
        { "data": "YYYY-MM-DD", "estado": "string", "laboratorio": "string ou null" }
      ]
    }
  ] | [],
  "alertas": ["string"],
  "proximo_passo": "string (sugestão prática, máx 30 palavras)"
}
`;

export const SYSTEM_SCORE = `
Você é um assistente de saúde preventiva do app Nauta.
Recebeu dados estruturados de exames clínicos e check-ins de pilares comportamentais.
Calcule o score de saúde e gere a narrativa de contexto.

REGRAS:
- Nunca diga que o usuário "está saudável" ou "está doente" — use linguagem de tendência.
- Sempre contextualizar o número com a tendência (subiu/desceu) e o pilar principal.
- O score nunca deve ser apresentado como objetivo a maximizar — é um espelho, não uma meta.
- Se dados forem insuficientes (<3 pilares), alertar sobre precisão limitada.

PESOS DOS PILARES:
- Exames clínicos: 35%
- Sono: 20%
- Estresse (PSS-4): 20%
- Atividade física: 15%
- Alimentação: 10%
- Adesão preventiva: multiplicador de confiança (não entra na média)

FORMATO DE SAÍDA — JSON puro, sem markdown:
{
  "score_geral": "number (0–100)",
  "tendencia": "subindo | estavel | caindo | primeiro_registro",
  "frase_contexto": "string (máx 25 palavras, destaca o pilar mais relevante)",
  "pilares": [
    {
      "nome": "string",
      "score": "number (0–100)",
      "fonte": "objetivo | autodeclarado",
      "status": "otimo | bom | atencao | incompleto",
      "detalhe": "string (máx 30 palavras)"
    }
  ],
  "confiabilidade": {
    "pilares_preenchidos": "number",
    "total_pilares": 6,
    "nivel": "alta | media | baixa",
    "mensagem": "string"
  },
  "comparacao_populacional": "string ou null (ex: 'acima de 61% das pessoas com perfil similar')",
  "proximo_passo": "string (ação mais impactante para melhorar o score)"
}
`;

export async function explicarLaudo(textoLaudo: string, perfilUsuario?: string) {
  const system = SYSTEM_EXPLICADOR.replace(
    "{perfil_usuario}",
    perfilUsuario ?? "Não informado"
  );
  const userMessage = `Laudo para explicar:\n\n${textoLaudo}`;
  const resposta = await callClaude(system, userMessage);
  return JSON.parse(resposta);
}

export async function compararExames(
  exames: { data: string; texto: string; laboratorio?: string }[],
  perfilUsuario?: string
) {
  const system = SYSTEM_EVOLUTIVO.replace(
    "{perfil_usuario}",
    perfilUsuario ?? "Não informado"
  );
  const examesFormatados = exames
    .map((e) => `Data: ${e.data}\nLaboratório: ${e.laboratorio ?? "não informado"}\n---\n${e.texto}`)
    .join("\n\n===PRÓXIMO EXAME===\n\n");
  const resposta = await callClaude(system, `Exames para comparar:\n\n${examesFormatados}`);
  return JSON.parse(resposta);
}

// ─── Mapa de Saúde ────────────────────────────────────────────────────────────

export type {
  MapaSaude,
  SistemaStatus,
  ResultadoRecomendacoes,
  RecomendacaoPreventiva,
} from "@/types/health";

import type { Exame, PerfilSaude } from "@/types/health";
import type {
  MapaSaude as MapaSaudeType,
  ResultadoRecomendacoes as ResultadoRecomendacoesType,
} from "@/types/health";

export const SYSTEM_MAPA = `
Você é um assistente de saúde preventiva do app Laudo Amigável.
Recebeu uma agregação de exames do usuário, agrupados por sistema fisiológico.
Gere um mapa de saúde sistêmico, equilibrando otimismo e honestidade.

REGRAS:
- Nunca diagnostique. Use linguagem de tendência e observação.
- Para sistemas sem exames, retorne status "sem_dados" e sugira o exame inicial pertinente.
- Status: otimo (todos parâmetros normais e estáveis/melhora), bom (maioria normal),
  atencao (algum parâmetro fora ou tendência de piora leve), alerta (achados relevantes
  ou variação >15%), sem_dados (nenhum exame deste sistema).
- A narrativa deve ser curta (máx 35 palavras), tom acolhedor, foco no panorama.
- Ação sugerida: prática, específica, máx 25 palavras.

SISTEMAS A AVALIAR (sempre todos os 9):
Cardiovascular, Metabólico, Hepatobiliar, Renal, Endócrino,
Hematológico, Respiratório, Musculoesquelético, Neurológico

FORMATO DE SAÍDA — JSON puro, sem markdown:
{
  "gerado_em": "YYYY-MM-DD",
  "resumo_geral": "string (máx 60 palavras, panorama geral encorajador)",
  "sistemas": [
    {
      "sistema": "string (um dos 9 acima)",
      "status": "otimo | bom | atencao | alerta | sem_dados",
      "ultimo_exame": "YYYY-MM-DD ou null",
      "achados_count": "number (total de achados deste sistema)",
      "achados_atencao": "number (achados em atenção/acompanhamento)",
      "parametros_recentes": [
        { "nome": "string", "tendencia": "melhora|estavel|atencao|piora", "ultimo_valor": "string ou null" }
      ],
      "narrativa": "string (máx 35 palavras)",
      "acao_sugerida": "string (máx 25 palavras)"
    }
  ]
}
`;

export const SYSTEM_PREVENTIVO = `
Você é um assistente de saúde preventiva do app Laudo Amigável.
Recebeu o perfil do usuário e seu histórico de exames.
Gere uma lista de recomendações preventivas personalizadas, baseadas em guidelines
brasileiras e internacionais (SBC, SBD, SBEM, USPSTF, MS).

REGRAS:
- Considere idade, sexo biológico, condições e histórico familiar.
- Para cada exame: avalie se o usuário está em dia (compare ultimo_realizado com frequencia_recomendada).
- Prioridade alta: exames críticos atrasados ou indicados pelo perfil de risco.
- Prioridade média: exames de rotina dentro da janela de atualização.
- Prioridade baixa: eletivos ou complementares.
- Sempre cite a fonte (ex: "SBC 2020", "USPSTF 2022", "MS — Caderneta de Saúde").
- Mensagem motivacional: tom acolhedor, sem alarmismo, máx 50 palavras.
- Próxima revisão: data sugerida para reavaliar (geralmente 6 meses).

FORMATO DE SAÍDA — JSON puro, sem markdown:
{
  "gerado_em": "YYYY-MM-DD",
  "perfil_considerado": "string (resumo curto do perfil usado: idade, sexo, condições)",
  "mensagem_motivacional": "string",
  "proxima_revisao": "YYYY-MM-DD",
  "recomendacoes": [
    {
      "id": "string (slug único do exame)",
      "exame": "string",
      "sistema": "string",
      "prioridade": "alta | media | baixa",
      "motivo": "string (justificativa personalizada, máx 40 palavras)",
      "frequencia_recomendada": "string (ex: 'anual', 'a cada 2 anos')",
      "ultimo_realizado": "YYYY-MM-DD ou null",
      "proximo_recomendado": "YYYY-MM-DD ou null",
      "esta_em_dia": "boolean",
      "acao": "agendar | repetir_em_breve | em_dia",
      "fonte_guideline": "string"
    }
  ]
}
`;

function formatPerfil(perfil: PerfilSaude): string {
  const idade = perfil.dataNascimento
    ? Math.floor((Date.now() - new Date(perfil.dataNascimento).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : "?";
  return `${perfil.nome || "Usuário"}, ${idade} anos, ${perfil.sexoBiologico || "não informado"}.
Condições: ${perfil.condicoes?.join(", ") || "nenhuma"}.
Histórico familiar: ${perfil.historicoFamiliar || "não informado"}.`;
}

export function agregarPorSistema(exames: Exame[]) {
  const sistemas: Record<string, {
    sistema: string;
    exames: { nome: string; data: string; laboratorio?: string; resumo?: string; achados_count: number; achados_atencao: number }[];
  }> = {};

  for (const e of exames) {
    const s = e.sistema || "Outro";
    if (!sistemas[s]) sistemas[s] = { sistema: s, exames: [] };
    const achados = e.resultado?.achados ?? [];
    sistemas[s].exames.push({
      nome: e.nome,
      data: e.data,
      laboratorio: e.laboratorio,
      resumo: e.resumo,
      achados_count: achados.length,
      achados_atencao: achados.filter((a: any) => a.status === "atencao" || a.status === "acompanhamento").length,
    });
  }

  return Object.values(sistemas);
}

export async function gerarMapaSaude(
  exames: Exame[],
  perfil: PerfilSaude
): Promise<MapaSaudeType> {
  const agregado = agregarPorSistema(exames);
  const userMessage = `
PERFIL: ${formatPerfil(perfil)}

DATA ATUAL: ${new Date().toISOString().split("T")[0]}

EXAMES AGREGADOS POR SISTEMA:
${JSON.stringify(agregado, null, 2)}

Gere o mapa de saúde retornando JSON conforme o formato especificado.
  `;
  const resposta = await callClaude(SYSTEM_MAPA, userMessage);
  return JSON.parse(resposta);
}

export async function gerarRecomendacoesPreventivas(
  exames: Exame[],
  perfil: PerfilSaude
): Promise<ResultadoRecomendacoesType> {
  const examesResumo = exames.map((e) => ({
    nome: e.nome,
    sistema: e.sistema,
    data: e.data,
  }));
  const userMessage = `
PERFIL: ${formatPerfil(perfil)}

DATA ATUAL: ${new Date().toISOString().split("T")[0]}

HISTÓRICO DE EXAMES (${exames.length} total):
${JSON.stringify(examesResumo, null, 2)}

Gere as recomendações preventivas personalizadas retornando JSON conforme o formato.
  `;
  const resposta = await callClaude(SYSTEM_PREVENTIVO, userMessage);
  return JSON.parse(resposta);
}

export async function calcularScore(dadosScore: {
  examesClinicosResumidos: string;
  checkin: {
    sono_horas?: string;
    sono_qualidade?: string;
    estresse_pss?: string;
    atividade_minutos?: string;
  };
  perfilUsuario?: string;
}) {
  const userMessage = `
Dados clínicos dos exames: ${dadosScore.examesClinicosResumidos}

Check-in comportamental:
- Sono (horas): ${dadosScore.checkin.sono_horas ?? "não informado"}
- Sono (qualidade): ${dadosScore.checkin.sono_qualidade ?? "não informado"}
- Estresse PSS: ${dadosScore.checkin.estresse_pss ?? "não informado"}
- Atividade física: ${dadosScore.checkin.atividade_minutos ?? "não informado"}

Perfil: ${dadosScore.perfilUsuario ?? "não informado"}

Calcule o score e retorne o JSON.
  `;
  const resposta = await callClaude(SYSTEM_SCORE, userMessage);
  return JSON.parse(resposta);
}

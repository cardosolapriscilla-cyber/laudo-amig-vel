import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BRIEFING_PROMPTS: Record<string, string> = {
  Cardiologista: "Priorize: lipídeos (LDL, HDL, triglicerídeos), pressão arterial, glicemia, PCR, ECG. Destaque tendências cardiovasculares.",
  Endocrinologista: "Priorize: TSH, T4L, glicemia, HbA1c, insulina, cortisol, vitamina D. Destaque padrões metabólicos.",
  Hepatologista: "Priorize: TGO, TGP, GGT, fosfatase alcalina, bilirrubinas, albumina. Destaque evolução hepática.",
  Nefrologista: "Priorize: creatinina, ureia, TFG, eletrólitos, proteinúria. Destaque função renal longitudinal.",
  Clínico: "Apresente visão geral de todos os sistemas. Destaque os 3 achados mais relevantes.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT and derive user identity from token (do NOT trust body)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const auth_user_id = userData.user.id;

    const { especialidade } = await req.json();

    if (!especialidade || typeof especialidade !== "string") {
      return new Response(
        JSON.stringify({ error: "especialidade é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: exames } = await supabase
      .from("exames")
      .select("nome, sistema, data, laboratorio, resumo, resultado_json")
      .eq("auth_user_id", auth_user_id)
      .order("data", { ascending: false })
      .limit(20);

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, data_nascimento, sexo_biologico, condicoes, historico_familiar")
      .eq("auth_user_id", auth_user_id)
      .single();

    const foco = BRIEFING_PROMPTS[especialidade] || BRIEFING_PROMPTS["Clínico"];

    const prompt = `
Você é um assistente médico gerando um briefing pré-consulta estruturado.

PACIENTE: ${perfil?.nome}, ${perfil?.sexo_biologico}, nasc. ${perfil?.data_nascimento}
CONDIÇÕES: ${perfil?.condicoes?.join(", ") || "nenhuma declarada"}
HISTÓRICO FAMILIAR: ${perfil?.historico_familiar || "não informado"}

ESPECIALIDADE DA CONSULTA: ${especialidade}
FOCO: ${foco}

EXAMES DOS ÚLTIMOS 3 ANOS:
${exames?.map((e) => `${e.data} — ${e.nome} (${e.laboratorio}): ${e.resumo}`).join("\n") || "nenhum exame disponível"}

Gere um briefing estruturado em JSON:
{
  "resumo_executivo": "string (máx 80 palavras — o que o médico precisa saber em 30 segundos)",
  "achados_prioritarios": [
    { "parametro": "string", "tendencia": "melhora|estavel|atencao|piora", "ultima_data": "YYYY-MM-DD", "ultimo_valor": "string", "nota": "string (1 linha)" }
  ],
  "cronologia": [
    { "data": "YYYY-MM-DD", "exame": "string", "destaque": "string (achado principal)" }
  ],
  "alertas": ["string"],
  "sugestoes_investigacao": ["string (baseado em gaps ou tendências)"]
}

Retorne APENAS o JSON, sem texto adicional.
`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Erro na API Claude: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText = data.content[0].text.replace(/```json|```/g, "").trim();
    const briefingJson = JSON.parse(rawText);

    const { data: briefing, error: insertError } = await supabase
      .from("shared_briefings")
      .insert({ auth_user_id, especialidade, briefing_json: briefingJson })
      .select("token")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Erro ao salvar briefing", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ token: briefing?.token, briefing: briefingJson }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro em generate-briefing:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

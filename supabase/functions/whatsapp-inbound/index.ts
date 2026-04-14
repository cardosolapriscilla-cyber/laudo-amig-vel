import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── SISTEMA DE INTENÇÕES ─────────────────────────────────────────────────────

const SYSTEM_INTENT = `
Você é o classificador de intenções do Laudo Amigável, um concierge de saúde via WhatsApp.
Analise a mensagem do paciente e retorne APENAS um JSON sem markdown:

{
  "intencao": "CONSULTA_AGENDAR" | "EXAME_ENVIAR" | "PERGUNTA_SAUDE" | "RESUMO_PEDIR" | 
               "DICA_PEDIR" | "AJUDA" | "ONBOARDING" | "OUTRA",
  "dados_extraidos": {
    "especialidade": "string ou null",
    "data_consulta": "YYYY-MM-DD ou null",
    "hora_consulta": "HH:MM ou null",
    "local": "string ou null",
    "texto_laudo": "string ou null (se colou um laudo)",
    "pergunta": "string ou null"
  },
  "confianca": "alta" | "media" | "baixa"
}

Exemplos:
- "Tenho cardiologista amanhã às 14h no Einstein" → CONSULTA_AGENDAR
- "TSH alterado, o que significa?" → PERGUNTA_SAUDE
- "Hemoglobina: 13.2, leucócitos: 7800..." → EXAME_ENVIAR
- "Quero ver meu histórico" → RESUMO_PEDIR
- "me manda uma dica de saúde" → DICA_PEDIR
`;

const SYSTEM_RESPONDER = `
Você é o Laudo Amigável, um concierge digital de saúde via WhatsApp.
Tom: amigável, claro, cuidadoso. Nunca alarmista. Nunca diagnostica.
Seja conciso — mensagens de WhatsApp devem ter no máximo 4 parágrafos curtos.
Sempre termine com uma ação clara ou pergunta simples.
Use *negrito* para termos importantes (formato WhatsApp).
Nunca use markdown complexo — apenas *negrito* e emojis discretos.
Disclaimer: sempre que falar sobre saúde, termine com "⚕️ Sempre converse com seu médico para orientação personalizada."

PERFIL DO PACIENTE:
{perfil}

HISTÓRICO RECENTE DE EXAMES:
{historico_exames}

CONSULTAS AGENDADAS:
{consultas}
`;

const SYSTEM_ANALISA_LAUDO = `
Você é um assistente de saúde preventiva do Laudo Amigável.
Analise o texto do laudo e retorne APENAS JSON sem markdown:

{
  "tipo_exame": "string",
  "sistema": "Cardiovascular|Metabólico|Hepatobiliar|Renal|Endócrino|Hematológico|Respiratório|Musculoesquelético|Neurológico|Outro",
  "laboratorio": "string ou null",
  "data_coleta": "YYYY-MM-DD ou null",
  "resumo_whatsapp": "string (máx 150 palavras, tom acolhedor, linguagem simples)",
  "achados_relevantes": [
    {
      "parametro": "string",
      "status": "normal|atencao|acompanhamento",
      "valor": "string ou null",
      "frase_simples": "string (1 linha)",
      "analogia": "string (1 linha, opcional)"
    }
  ],
  "alerta": "string ou null (só se variação crítica)",
  "perguntas_medico": ["string", "string"],
  "proximo_exame_em_meses": "number ou null"
}
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function callClaude(system: string, message: string, maxTokens = 1000): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: message }],
    }),
  });
  const data = await response.json();
  return data.content[0].text;
}

async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const zApiInstance = Deno.env.get("ZAPI_INSTANCE")!;
  const zApiToken = Deno.env.get("ZAPI_TOKEN")!;
  const zApiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN")!;

  await fetch(`https://api.z-api.io/instances/${zApiInstance}/token/${zApiToken}/send-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": zApiClientToken,
    },
    body: JSON.stringify({ phone, message }),
  });
}

async function getOrCreateUser(phone: string): Promise<any> {
  const { data } = await supabase
    .from("whatsapp_users")
    .select("*")
    .eq("phone", phone)
    .single();

  if (data) return data;

  const { data: newUser } = await supabase
    .from("whatsapp_users")
    .insert({ phone })
    .select()
    .single();

  return newUser;
}

async function getUserContext(userId: string): Promise<{ exames: any[]; consultas: any[] }> {
  const { data: exames } = await supabase
    .from("whatsapp_exames")
    .select("nome, sistema, data_coleta, laboratorio, resumo")
    .eq("user_id", userId)
    .order("data_coleta", { ascending: false })
    .limit(5);

  const { data: consultas } = await supabase
    .from("consultas_agendadas")
    .select("especialidade, local_consulta, data_consulta")
    .eq("user_id", userId)
    .gte("data_consulta", new Date().toISOString())
    .order("data_consulta")
    .limit(3);

  return { exames: exames || [], consultas: consultas || [] };
}

async function saveMessage(userId: string, direcao: "inbound" | "outbound", conteudo: string) {
  await supabase.from("whatsapp_mensagens").insert({ user_id: userId, direcao, conteudo });
}

// ─── HANDLERS POR INTENÇÃO ────────────────────────────────────────────────────

async function handleOnboarding(user: any, phone: string) {
  if (!user.onboarding_completo) {
    const msg = `Olá! 👋 Sou o *Laudo Amigável*, seu concierge de saúde.\n\nPara personalizar suas explicações, me diz:\n\n1️⃣ Qual seu nome?\n2️⃣ Data de nascimento (DD/MM/AAAA)?\n3️⃣ Sexo biológico (M/F)?\n\nResponda tudo em uma mensagem, ex: "João, 15/03/1975, M"`;
    await sendWhatsApp(phone, msg);
    return;
  }
}

async function handleConsultaAgendar(user: any, phone: string, dados: any) {
  if (!dados.especialidade) {
    await sendWhatsApp(phone, "Entendi que você quer registrar uma consulta! Me fala: *qual especialidade*, *data* e *hora*? Ex: 'Cardiologista dia 20/05 às 14h'");
    return;
  }

  const dataConsulta = dados.data_consulta
    ? new Date(dados.data_consulta + (dados.hora_consulta ? `T${dados.hora_consulta}:00` : "T12:00:00"))
    : null;

  if (!dataConsulta) {
    await sendWhatsApp(phone, "Qual a data e hora da consulta?");
    return;
  }

  await supabase.from("consultas_agendadas").insert({
    user_id: user.id,
    especialidade: dados.especialidade,
    local_consulta: dados.local || null,
    data_consulta: dataConsulta.toISOString(),
  });

  const { exames } = await getUserContext(user.id);
  const temHistorico = exames.length > 0;

  const confirmacao = `✅ Consulta registrada!\n\n*${dados.especialidade}*\n📅 ${dataConsulta.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}${dados.hora_consulta ? " às " + dados.hora_consulta : ""}${dados.local ? "\n📍 " + dados.local : ""}\n\nVou te lembrar 24h antes.${temHistorico ? "\n\nQuer que eu prepare um *resumo do seu histórico* para levar à consulta?" : ""}`;

  await sendWhatsApp(phone, confirmacao);
}

async function handleExameEnviar(user: any, phone: string, textoLaudo: string) {
  await sendWhatsApp(phone, "📋 Recebi seu laudo! Analisando agora... *Aguarde um momento.*");

  const resultadoRaw = await callClaude(SYSTEM_ANALISA_LAUDO, textoLaudo, 1200);
  const resultado = JSON.parse(resultadoRaw.replace(/```json|```/g, "").trim());

  await supabase.from("whatsapp_exames").insert({
    user_id: user.id,
    tipo: resultado.sistema?.includes("Imagem") ? "imagem" : "sangue",
    nome: resultado.tipo_exame,
    sistema: resultado.sistema,
    data_coleta: resultado.data_coleta || new Date().toISOString().split("T")[0],
    laboratorio: resultado.laboratorio,
    texto_original: textoLaudo,
    resumo: resultado.resumo_whatsapp,
    resultado_json: resultado,
  });

  if (resultado.proximo_exame_em_meses) {
    const dataProximo = new Date();
    dataProximo.setMonth(dataProximo.getMonth() + resultado.proximo_exame_em_meses);

    await supabase.from("lembretes_preventivos").insert({
      user_id: user.id,
      tipo_exame: resultado.tipo_exame,
      data_ultimo: resultado.data_coleta || new Date().toISOString().split("T")[0],
      data_proximo: dataProximo.toISOString().split("T")[0],
      motivo: `Repetir ${resultado.tipo_exame} em ${resultado.proximo_exame_em_meses} meses`,
    });
  }

  let resposta = `🔬 *${resultado.tipo_exame}*\n\n${resultado.resumo_whatsapp}`;

  if (resultado.alerta) {
    resposta += `\n\n⚠️ *Atenção:* ${resultado.alerta}`;
  }

  if (resultado.achados_relevantes?.length > 0) {
    const relevantes = resultado.achados_relevantes.filter((a: any) => a.status !== "normal");
    if (relevantes.length > 0) {
      resposta += "\n\n*Achados que merecem atenção:*";
      for (const achado of relevantes.slice(0, 3)) {
        resposta += `\n• *${achado.parametro}:* ${achado.frase_simples}`;
        if (achado.analogia) resposta += ` (${achado.analogia})`;
      }
    }
  }

  if (resultado.perguntas_medico?.length > 0) {
    resposta += "\n\n💬 *Perguntas para levar ao médico:*\n" +
      resultado.perguntas_medico.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n");
  }

  resposta += "\n\n⚕️ Sempre converse com seu médico para orientação personalizada.";
  resposta += "\n\nVer resultado completo no app: *laudoamigavel.com.br*";

  await sendWhatsApp(phone, resposta);
}

async function handlePerguntaSaude(user: any, phone: string, pergunta: string) {
  const { exames, consultas } = await getUserContext(user.id);

  const perfil = user.nome
    ? `${user.nome}, ${user.sexo || ""}, nasc. ${user.data_nascimento || "não informado"}`
    : "Perfil não preenchido";

  const system = SYSTEM_RESPONDER
    .replace("{perfil}", perfil)
    .replace("{historico_exames}", exames.map(e => `${e.nome} (${e.data_coleta}): ${e.resumo}`).join("\n") || "Nenhum exame registrado")
    .replace("{consultas}", consultas.map(c => `${c.especialidade} em ${c.data_consulta}`).join("\n") || "Nenhuma consulta agendada");

  const resposta = await callClaude(system, pergunta, 600);
  await sendWhatsApp(phone, resposta);
}

async function handleResumo(user: any, phone: string) {
  const { exames, consultas } = await getUserContext(user.id);

  if (exames.length === 0) {
    await sendWhatsApp(phone, "Ainda não tenho nenhum exame seu registrado. Envie o texto de um laudo e começo a construir seu histórico! 📋");
    return;
  }

  let resumo = `📊 *Seu histórico de saúde*\n\n`;
  resumo += `*Últimos exames:*\n`;
  for (const e of exames) {
    resumo += `• ${e.nome} — ${new Date(e.data_coleta + "T12:00:00").toLocaleDateString("pt-BR")}`;
    if (e.laboratorio) resumo += ` (${e.laboratorio})`;
    if (e.resumo) resumo += `\n  _${e.resumo.slice(0, 80)}..._`;
    resumo += "\n";
  }

  if (consultas.length > 0) {
    resumo += `\n*Próximas consultas:*\n`;
    for (const c of consultas) {
      resumo += `• ${c.especialidade} — ${new Date(c.data_consulta).toLocaleDateString("pt-BR")}`;
      if (c.local_consulta) resumo += ` (${c.local_consulta})`;
      resumo += "\n";
    }
  }

  resumo += `\nVer histórico completo: *laudoamigavel.com.br*`;
  await sendWhatsApp(phone, resumo);
}

async function handleDica(user: any, phone: string) {
  const { exames } = await getUserContext(user.id);

  const { data: dicasEnviadas } = await supabase
    .from("dicas_enviadas")
    .select("tema")
    .eq("user_id", user.id);

  const temasUsados = dicasEnviadas?.map(d => d.tema) || [];

  const contexto = exames.length > 0
    ? `Paciente tem histórico: ${exames.map(e => e.sistema).filter(Boolean).join(", ")}.`
    : "Paciente sem histórico de exames.";

  const prompt = `${contexto} Temas já enviados: ${temasUsados.join(", ") || "nenhum"}.
  
  Gere uma dica de saúde preventiva em formato WhatsApp:
  - 3–4 linhas no máximo
  - Baseada em evidência científica
  - Cite a fonte (sociedade médica ou ministério)
  - Tom amigável, não alarmista
  - Relacionada ao perfil se possível
  - Retorne JSON: {"tema": "string", "dica": "string"}`;

  const resultadoRaw = await callClaude("Você é um assistente de saúde preventiva.", prompt, 300);
  const resultado = JSON.parse(resultadoRaw.replace(/```json|```/g, "").trim());

  await supabase.from("dicas_enviadas").insert({ user_id: user.id, tema: resultado.tema });
  await sendWhatsApp(phone, `💡 *Dica de saúde da semana*\n\n${resultado.dica}`);
}

async function handleAjuda(phone: string) {
  const menu = `🌿 *Laudo Amigável — o que posso fazer por você:*

📋 *Enviar laudo:* Cole o texto do seu resultado e explico tudo em linguagem simples

📅 *Registrar consulta:* "Tenho cardiologista dia 20/05 às 14h" — te lembro 24h antes

📊 *Ver histórico:* Digite "resumo"

💡 *Dica de saúde:* Digite "dica"

❓ *Tirar dúvida:* Pergunte qualquer coisa sobre saúde

⚕️ Não substituo consulta médica.`;

  await sendWhatsApp(phone, menu);
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    const phone = body.phone || body.from?.replace("@s.whatsapp.net", "");
    const messageText = body.text?.message || body.body || "";

    if (!phone || !messageText) {
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const user = await getOrCreateUser(phone);
    await saveMessage(user.id, "inbound", messageText);

    if (!user.onboarding_completo && !user.nome) {
      const onboardingPattern = /^(.+),\s*(\d{2}\/\d{2}\/\d{4}),\s*([MFmf])$/;
      const match = messageText.match(onboardingPattern);

      if (match) {
        const [, nome, dataNasc, sexoChar] = match;
        const [dia, mes, ano] = dataNasc.split("/");
        await supabase.from("whatsapp_users").update({
          nome: nome.trim(),
          data_nascimento: `${ano}-${mes}-${dia}`,
          sexo: sexoChar.toLowerCase() === "m" ? "masculino" : "feminino",
          onboarding_completo: true,
        }).eq("id", user.id);

        await sendWhatsApp(phone, `Olá, *${nome.trim()}*! 🌿 Tudo pronto.\n\nAgora você pode:\n• Enviar laudos para eu explicar\n• Registrar consultas\n• Receber lembretes preventivos\n\nDigite *ajuda* para ver tudo que posso fazer por você.`);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      } else {
        await handleOnboarding(user, phone);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
    }

    const intentRaw = await callClaude(SYSTEM_INTENT, messageText, 300);
    const intent = JSON.parse(intentRaw.replace(/```json|```/g, "").trim());

    switch (intent.intencao) {
      case "CONSULTA_AGENDAR":
        await handleConsultaAgendar(user, phone, intent.dados_extraidos);
        break;
      case "EXAME_ENVIAR":
        await handleExameEnviar(user, phone, intent.dados_extraidos.texto_laudo || messageText);
        break;
      case "PERGUNTA_SAUDE":
        await handlePerguntaSaude(user, phone, intent.dados_extraidos.pergunta || messageText);
        break;
      case "RESUMO_PEDIR":
        await handleResumo(user, phone);
        break;
      case "DICA_PEDIR":
        await handleDica(user, phone);
        break;
      case "AJUDA":
      default:
        await handleAjuda(phone);
        break;
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

  } catch (error) {
    console.error("Erro no whatsapp-inbound:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendWhatsApp(phone: string, message: string) {
  const zApiInstance = Deno.env.get("ZAPI_INSTANCE")!;
  const zApiToken = Deno.env.get("ZAPI_TOKEN")!;
  const zApiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN")!;

  await fetch(`https://api.z-api.io/instances/${zApiInstance}/token/${zApiToken}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": zApiClientToken },
    body: JSON.stringify({ phone, message }),
  });
}

async function callClaude(system: string, message: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: message }],
    }),
  });
  const data = await response.json();
  return data.content[0].text;
}

// ─── JOB 1: Lembretes de consulta (24h antes) ────────────────────────────────

async function jobLembretesConsulta() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const inicio = new Date(amanha); inicio.setHours(0, 0, 0, 0);
  const fim = new Date(amanha); fim.setHours(23, 59, 59, 999);

  const { data: consultas } = await supabase
    .from("consultas_agendadas")
    .select("*, whatsapp_users(phone, nome, id)")
    .gte("data_consulta", inicio.toISOString())
    .lte("data_consulta", fim.toISOString())
    .eq("lembrete_enviado", false);

  for (const consulta of consultas || []) {
    const user = consulta.whatsapp_users;
    if (!user?.phone) continue;

    const { data: exames } = await supabase
      .from("whatsapp_exames")
      .select("nome, data_coleta, resumo, sistema")
      .eq("user_id", user.id)
      .order("data_coleta", { ascending: false })
      .limit(5);

    const hora = new Date(consulta.data_consulta).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const temExames = exames && exames.length > 0;

    let msg = `🔔 *Lembrete de consulta*\n\n`;
    msg += `Amanhã você tem *${consulta.especialidade}* às ${hora}`;
    if (consulta.local_consulta) msg += ` em ${consulta.local_consulta}`;
    msg += ".\n\n";

    if (temExames) {
      const resumoPrompt = `Gere um resumo pré-consulta curto (máx 100 palavras) para um paciente com ${consulta.especialidade}.
      Exames recentes: ${exames.map(e => `${e.nome} (${e.data_coleta}): ${e.resumo || ""}`).join("; ")}.
      Tom amigável. Formato WhatsApp. Destaque o que é mais relevante para essa especialidade.`;

      const resumo = await callClaude(
        "Você é o Laudo Amigável, concierge de saúde. Seja conciso e direto.",
        resumoPrompt
      );
      msg += `📋 *Resumo do seu histórico:*\n${resumo}\n\n`;
    }

    msg += "Boa consulta! 🌿";

    await sendWhatsApp(user.phone, msg);
    await supabase
      .from("consultas_agendadas")
      .update({ lembrete_enviado: true })
      .eq("id", consulta.id);
  }
}

// ─── JOB 2: Alertas preventivos por data-marco ───────────────────────────────

async function jobAlertasPreventivos() {
  const hoje = new Date().toISOString().split("T")[0];

  const { data: lembretes } = await supabase
    .from("lembretes_preventivos")
    .select("*, whatsapp_users(phone, nome)")
    .lte("data_proximo", hoje)
    .eq("enviado", false);

  for (const lembrete of lembretes || []) {
    const user = lembrete.whatsapp_users;
    if (!user?.phone) continue;

    const msg = `🌿 *Lembrete preventivo*\n\n${user.nome ? `Oi ${user.nome}! ` : ""}${lembrete.motivo}.\n\n*${lembrete.tipo_exame}* — quando foi o último?\n\nSe já fez recentemente, me envie o resultado para eu registrar. Se ainda não fez, este pode ser um bom momento para agendar.\n\n${lembrete.fonte_guideline ? `_Fonte: ${lembrete.fonte_guideline}_\n\n` : ""}⚕️ Sempre converse com seu médico para orientação personalizada.`;

    await sendWhatsApp(user.phone, msg);
    await supabase
      .from("lembretes_preventivos")
      .update({ enviado: true })
      .eq("id", lembrete.id);
  }
}

// ─── JOB 3: Marcos preventivos por perfil (roda 1x/semana) ──────────────────

async function jobMarcosPreventivos() {
  const { data: usuarios } = await supabase
    .from("whatsapp_users")
    .select("*")
    .eq("ativo", true)
    .eq("onboarding_completo", true);

  const hoje = new Date();

  for (const user of usuarios || []) {
    if (!user.data_nascimento) continue;

    const idade = Math.floor(
      (hoje.getTime() - new Date(user.data_nascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    const { data: exames } = await supabase
      .from("whatsapp_exames")
      .select("nome, data_coleta")
      .eq("user_id", user.id);

    const { data: lembretesExistentes } = await supabase
      .from("lembretes_preventivos")
      .select("tipo_exame")
      .eq("user_id", user.id);

    const tiposLembrete = lembretesExistentes?.map(l => l.tipo_exame.toLowerCase()) || [];

    interface Diretriz {
      condicao: boolean;
      tipo_exame: string;
      intervalo_meses: number;
      motivo: string;
      fonte: string;
    }

    const diretrizes: Diretriz[] = [
      {
        condicao: user.sexo === "feminino" && idade >= 40 && !tiposLembrete.includes("mamografia"),
        tipo_exame: "Mamografia",
        intervalo_meses: 12,
        motivo: `Mulheres a partir dos 40 anos devem realizar mamografia anualmente`,
        fonte: "Ministério da Saúde / INCA",
      },
      {
        condicao: user.sexo === "feminino" && idade >= 25 && idade <= 64 && !tiposLembrete.includes("papanicolau"),
        tipo_exame: "Papanicolau / HPV-DNA",
        intervalo_meses: 36,
        motivo: `Mulheres de 25 a 64 anos devem realizar o preventivo a cada 3 anos`,
        fonte: "MS/INCA 2016 — Diretrizes Brasileiras",
      },
      {
        condicao: idade >= 35 && !tiposLembrete.includes("perfil lipídico") && !tiposLembrete.includes("colesterol"),
        tipo_exame: "Perfil lipídico",
        intervalo_meses: 60,
        motivo: `Perfil lipídico recomendado a cada 5 anos para adultos a partir dos 35 anos`,
        fonte: "Sociedade Brasileira de Cardiologia 2020",
      },
      {
        condicao: idade >= 45 && !tiposLembrete.includes("glicemia"),
        tipo_exame: "Glicemia em jejum",
        intervalo_meses: 36,
        motivo: `Glicemia em jejum recomendada a cada 3 anos a partir dos 45 anos`,
        fonte: "Sociedade Brasileira de Diabetes / Ministério da Saúde",
      },
      {
        condicao: idade >= 45 && !tiposLembrete.includes("colonoscopia"),
        tipo_exame: "Colonoscopia",
        intervalo_meses: 120,
        motivo: `Colonoscopia recomendada a cada 10 anos a partir dos 45 anos para detecção precoce de câncer colorretal`,
        fonte: "INCA / USPSTF",
      },
      {
        condicao: user.sexo === "masculino" && idade >= 50 && !tiposLembrete.includes("psa"),
        tipo_exame: "PSA (próstata)",
        intervalo_meses: 12,
        motivo: `Homens a partir dos 50 anos devem discutir o rastreamento de próstata com o médico`,
        fonte: "Sociedade Brasileira de Urologia / CFM",
      },
      {
        condicao: user.sexo === "feminino" && idade >= 65 && !tiposLembrete.includes("densitometria"),
        tipo_exame: "Densitometria óssea",
        intervalo_meses: 24,
        motivo: `Mulheres a partir dos 65 anos devem realizar densitometria óssea a cada 2 anos`,
        fonte: "FEBRASGO / Ministério da Saúde",
      },
    ];

    for (const diretriz of diretrizes) {
      if (!diretriz.condicao) continue;

      const exameExistente = exames?.find(e =>
        e.nome.toLowerCase().includes(diretriz.tipo_exame.toLowerCase().split(" ")[0])
      );

      if (exameExistente) {
        const dataExame = new Date(exameExistente.data_coleta);
        const mesesPassados = (hoje.getTime() - dataExame.getTime()) / (30 * 24 * 60 * 60 * 1000);

        if (mesesPassados < diretriz.intervalo_meses * 0.9) continue;
      }

      const dataProximo = new Date();
      if (!exameExistente) dataProximo.setDate(dataProximo.getDate() + 3);

      await supabase.from("lembretes_preventivos").insert({
        user_id: user.id,
        tipo_exame: diretriz.tipo_exame,
        data_ultimo: exameExistente?.data_coleta || null,
        data_proximo: dataProximo.toISOString().split("T")[0],
        motivo: diretriz.motivo,
        fonte_guideline: diretriz.fonte,
      });
    }
  }
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const job = body.job || "all";

    if (job === "lembretes_consulta" || job === "all") {
      await jobLembretesConsulta();
    }
    if (job === "alertas_preventivos" || job === "all") {
      await jobAlertasPreventivos();
    }
    if (job === "marcos_preventivos" || job === "all") {
      await jobMarcosPreventivos();
    }

    return new Response(JSON.stringify({ ok: true, job }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro no scheduler:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

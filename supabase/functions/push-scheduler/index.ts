import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_EMAIL = Deno.env.get("VAPID_EMAIL") ?? "mailto:contato@nauta.app.br";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  actions?: { action: string; title: string }[];
}

async function sendPush(userId: string, payload: PushPayload): Promise<boolean> {
  const { data: sub, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error || !sub) return false;

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: any) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await supabase.from("push_subscriptions").delete().eq("auth_user_id", userId);
    }
    return false;
  }
}

async function jobLembretesPreventivos() {
  const hoje = new Date();
  const em7dias = new Date(hoje);
  em7dias.setDate(hoje.getDate() + 7);

  const { data: lembretes } = await supabase
    .from("lembretes_preventivos")
    .select("*")
    .lte("data_recomendada", em7dias.toISOString().split("T")[0])
    .gte("data_recomendada", hoje.toISOString().split("T")[0])
    .is("push_enviado", null);

  let enviados = 0;
  for (const l of lembretes ?? []) {
    if (!l.auth_user_id || !l.data_recomendada) continue;

    const diasRestantes = Math.ceil(
      (new Date(l.data_recomendada).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
    );

    const bodyMap: Record<number, string> = {
      7: `Em 7 dias é a data recomendada para ${l.exame}. Que tal agendar?`,
      3: `Faltam 3 dias para ${l.exame}. Não esqueça de agendar!`,
      1: `Amanhã é a data recomendada para ${l.exame}.`,
      0: `Hoje é o dia recomendado para ${l.exame}. Cuide da sua saúde!`,
    };

    const body = bodyMap[diasRestantes] ??
      `É hora de ${l.exame} — data recomendada: ${new Date(l.data_recomendada).toLocaleDateString("pt-BR")}`;

    // Verificar se há clínica associada ao sistema do lembrete
    const { data: clinicaSugerida } = await supabase
      .from("clinicas_usuario")
      .select("id, nome, whatsapp")
      .eq("auth_user_id", l.auth_user_id)
      .contains("sistemas", [l.sistema])
      .not("whatsapp", "is", null)
      .maybeSingle();

    const bodyComClinica = clinicaSugerida
      ? `${body} Toque para enviar mensagem para ${clinicaSugerida.nome}.`
      : body;

    const ok = await sendPush(l.auth_user_id, {
      title: "Nauta — Lembrete preventivo",
      body: bodyComClinica,
      tag: `lembrete-${l.id}`,
      url: clinicaSugerida ? "/clinicas" : "/prevencao",
      actions: [{ action: "ver", title: clinicaSugerida ? "Ver contato" : "Ver recomendações" }],
    });

    if (ok) {
      await supabase
        .from("lembretes_preventivos")
        .update({ push_enviado: new Date().toISOString() })
        .eq("id", l.id);
      enviados++;
    }
  }

  return { job: "lembretes_preventivos", enviados };
}

async function jobScoreDesatualizado() {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 90);

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("auth_user_id, ultimo_score_push")
    .or(`ultimo_score_push.is.null,ultimo_score_push.lte.${threshold.toISOString()}`);

  let enviados = 0;
  for (const sub of subs ?? []) {
    const ok = await sendPush(sub.auth_user_id, {
      title: "Nauta — Seu índice de saúde",
      body: "Faz mais de 90 dias desde sua última avaliação. Envie um exame novo para atualizar seu índice.",
      tag: "score-desatualizado",
      url: "/score",
    });

    if (ok) {
      await supabase
        .from("push_subscriptions")
        .update({ ultimo_score_push: new Date().toISOString() })
        .eq("auth_user_id", sub.auth_user_id);
      enviados++;
    }
  }

  return { job: "score_desatualizado", enviados };
}

async function jobLembretesConsulta() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const inicio = new Date(amanha); inicio.setHours(0, 0, 0, 0);
  const fim = new Date(amanha); fim.setHours(23, 59, 59, 999);

  const { data: consultas } = await supabase
    .from("consultas_agendadas")
    .select("*")
    .gte("data_consulta", inicio.toISOString())
    .lte("data_consulta", fim.toISOString())
    .is("push_enviado", null);

  let enviados = 0;
  for (const c of consultas ?? []) {
    if (!c.auth_user_id) continue;

    const hora = new Date(c.data_consulta).toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit",
    });

    const ok = await sendPush(c.auth_user_id, {
      title: `Nauta — Consulta amanhã`,
      body: `${c.especialidade} às ${hora}${c.local_consulta ? ` — ${c.local_consulta}` : ""}`,
      tag: `consulta-${c.id}`,
      url: "/consulta",
      actions: [{ action: "perguntas", title: "Ver perguntas" }],
    });

    if (ok) {
      await supabase
        .from("consultas_agendadas")
        .update({ push_enviado: new Date().toISOString() })
        .eq("id", c.id);
      enviados++;
    }
  }

  return { job: "lembretes_consulta", enviados };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Verificação simples de autorização: precisa do service role
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || !authHeader.includes(serviceRoleKey ?? "___")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const results = await Promise.all([
      jobLembretesPreventivos(),
      jobScoreDesatualizado(),
      jobLembretesConsulta(),
    ]);

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// supabase/functions/validar-whatsapp/index.ts
// Chamado via pg_cron semanalmente para validar números das clínicas
// Usa Z-API (já integrada no projeto) para verificar se o número existe no WhatsApp

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ZAPI_INSTANCE    = Deno.env.get("ZAPI_INSTANCE")!;
const ZAPI_TOKEN       = Deno.env.get("ZAPI_TOKEN")!;
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verifica se o número existe no WhatsApp via Z-API
async function verificarNumero(numero: string): Promise<boolean> {
  const clean = numero.replace(/\D/g, "");
  const phone = clean.startsWith("55") ? clean : `55${clean}`;

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/phone-exists/${phone}`,
      {
        headers: {
          "Client-Token": ZAPI_CLIENT_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) return false;
    const data = await res.json();
    // Z-API retorna { exists: true/false }
    return data.exists === true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Busca clínicas que nunca foram verificadas ou verificadas há mais de 30 dias
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);

    const { data: clinicas, error } = await supabase
      .from("clinicas_usuario")
      .select("id, whatsapp")
      .not("whatsapp", "is", null)
      .or(`verificado_em.is.null,verificado_em.lte.${threshold.toISOString()}`)
      .limit(50); // max 50 por execução para não estourar rate limit

    if (error) throw error;

    let verificados = 0;
    let validos = 0;

    for (const clinica of clinicas ?? []) {
      if (!clinica.whatsapp) continue;

      const valido = await verificarNumero(clinica.whatsapp);

      await supabase
        .from("clinicas_usuario")
        .update({
          whatsapp_valido: valido,
          verificado_em: new Date().toISOString(),
        })
        .eq("id", clinica.id);

      verificados++;
      if (valido) validos++;

      // Pequeno delay para respeitar rate limit da Z-API
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ ok: true, verificados, validos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

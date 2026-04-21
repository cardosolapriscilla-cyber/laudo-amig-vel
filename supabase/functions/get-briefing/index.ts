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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token");
    if (!token && req.method === "POST") {
      try {
        const body = await req.json();
        token = body?.token ?? null;
      } catch (_) { /* ignore */ }
    }

    if (!token || typeof token !== "string" || token.length < 16 || token.length > 128) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("shared_briefings")
      .select("briefing_json, especialidade, expires_at, created_at")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      console.error("get-briefing query error:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar briefing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Briefing não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(data.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Briefing expirado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fire-and-forget access timestamp
    supabase
      .from("shared_briefings")
      .update({ accessed_at: new Date().toISOString() })
      .eq("token", token)
      .then(() => {});

    return new Response(
      JSON.stringify({
        briefing_json: data.briefing_json,
        especialidade: data.especialidade,
        created_at: data.created_at,
        expires_at: data.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("get-briefing error:", e);
    return new Response(
      JSON.stringify({ error: "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── PROMPT DE DETECÇÃO DE TIPO ───────────────────────────────────────────────

const SYSTEM_DETECT = `
Você é um classificador de exames médicos brasileiros.
Analise o texto/imagem e retorne APENAS um JSON sem markdown:

{
  "tipo": "sangue" | "imagem" | "outros",
  "nome": "string (nome padronizado do exame, ex: 'Hemograma Completo', 'Ultrassonografia Abdominal')",
  "sistema": "Cardiovascular" | "Metabólico" | "Hepatobiliar" | "Renal" | "Endócrino" | "Hematológico" | "Respiratório" | "Musculoesquelético" | "Neurológico" | "Outro",
  "laboratorio": "string ou null",
  "data_coleta": "YYYY-MM-DD ou null"
}

EXEMPLOS DE CLASSIFICAÇÃO:
- Hemograma, VHS, leucócitos → tipo: sangue, sistema: Hematológico
- Colesterol, triglicerídeos, glicemia → tipo: sangue, sistema: Metabólico
- TSH, T4, insulina → tipo: sangue, sistema: Endócrino
- Creatinina, ureia, EAS → tipo: sangue, sistema: Renal
- TGO, TGP, bilirrubina, GGT → tipo: sangue, sistema: Hepatobiliar
- Ultrassom, tomografia, ressonância, raio-x → tipo: imagem
- PSA, AFP, CA-125 → tipo: sangue, sistema: Outro
- ECG, ecocardiograma → tipo: imagem, sistema: Cardiovascular
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildImageContent(base64: string, mediaType: string) {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mediaType,
      data: base64,
    },
  };
}

async function callClaude(
  system: string,
  content: unknown[],
  maxTokens = 2500
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API ${response.status}: ${err}`);
  }

  const data = await response.json();
  let text: string = data.content[0].text;
  // Strip markdown fences
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return text;
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, systemPrompt, userMessage, imageBase64, imageMediaType, pdfBase64 } = body;

    // ── MODO: OCR (imagem ou PDF) ──────────────────────────────────────────────
    if (mode === "ocr") {
      if (!imageBase64 && !pdfBase64) {
        return new Response(JSON.stringify({ error: "imageBase64 ou pdfBase64 obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let content: unknown[];

      if (pdfBase64) {
        content = [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: "Extraia TODO o texto deste exame médico. Preserve valores numéricos, unidades, datas e o cabeçalho do laboratório. Retorne apenas o texto extraído, sem comentários.",
          },
        ];
      } else {
        const mt = imageMediaType || "image/jpeg";
        content = [
          buildImageContent(imageBase64, mt),
          {
            type: "text",
            text: "Extraia TODO o texto deste exame médico. Preserve valores numéricos, unidades, datas e o cabeçalho do laboratório. Retorne apenas o texto extraído, sem comentários.",
          },
        ];
      }

      const textoExtraido = await callClaude(
        "Você é um sistema de OCR médico especializado em laudos e exames brasileiros. Sua única tarefa é extrair texto fiel ao documento. Nunca interprete, nunca adicione, nunca omita.",
        content,
        1500
      );

      return new Response(JSON.stringify({ text: textoExtraido }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MODO: DETECT (classificar tipo de exame) ───────────────────────────────
    if (mode === "detect") {
      if (!userMessage && !imageBase64 && !pdfBase64) {
        return new Response(JSON.stringify({ error: "userMessage ou imagem obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let content: unknown[];

      if (imageBase64 || pdfBase64) {
        if (pdfBase64) {
          content = [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: "Classifique este exame médico conforme o formato especificado." },
          ];
        } else {
          content = [
            buildImageContent(imageBase64, imageMediaType || "image/jpeg"),
            { type: "text", text: "Classifique este exame médico conforme o formato especificado." },
          ];
        }
      } else {
        content = [{ type: "text", text: `Texto do exame:\n\n${userMessage}` }];
      }

      const result = await callClaude(SYSTEM_DETECT, content, 200);

      return new Response(JSON.stringify({ text: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MODO: ANALYZE (comportamento original — análise de laudo) ──────────────
    if (!systemPrompt || !userMessage) {
      return new Response(JSON.stringify({ error: "systemPrompt e userMessage obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Holter e laudos longos podem ter muitas páginas; aumentamos a janela mas
    // protegemos contra payloads que estourariam o contexto do modelo.
    const MAX_CHARS = 18000;
    const truncated = userMessage.length > MAX_CHARS
      ? userMessage.slice(0, MAX_CHARS) + "\n\n[Texto truncado para caber na análise. Foque no conteúdo disponível.]"
      : userMessage;

    let content: unknown[];

    if (imageBase64) {
      content = [
        buildImageContent(imageBase64, imageMediaType || "image/jpeg"),
        { type: "text", text: truncated },
      ];
    } else {
      content = [{ type: "text", text: truncated }];
    }

    const text = await callClaude(systemPrompt, content, 2500);

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

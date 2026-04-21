import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Image, FileUp, Check, Loader2, AlertCircle } from "lucide-react";
import { useExamStore } from "@/stores/examStore";
import { explicarLaudo, compararExames } from "@/lib/claude";
import { supabase } from "@/integrations/supabase/client";
import type { TipoExame, SistemaExame } from "@/types/health";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function ocrViaEdgeFunction(
  base64: string,
  mediaType: string,
  isPdf: boolean
): Promise<string> {
  const body = isPdf
    ? { mode: "ocr", pdfBase64: base64 }
    : { mode: "ocr", imageBase64: base64, imageMediaType: mediaType };

  const { data, error } = await supabase.functions.invoke("analyze-exam", { body });
  if (error) throw new Error(`OCR falhou: ${error.message}`);
  if (data.error) throw new Error(data.error);
  return data.text as string;
}

async function detectViaEdgeFunction(texto: string): Promise<{
  tipo: TipoExame;
  nome: string;
  sistema: SistemaExame;
  laboratorio: string | null;
  data_coleta: string | null;
}> {
  const { data, error } = await supabase.functions.invoke("analyze-exam", {
    body: { mode: "detect", userMessage: texto },
  });
  if (error) throw new Error(`Detecção falhou: ${error.message}`);
  if (data.error) throw new Error(data.error);
  return JSON.parse(data.text);
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const ACCEPT_PDF = "application/pdf";

type Step =
  | "choose"
  | "text"
  | "ocr_processing"
  | "detecting"
  | "detected"
  | "analyzing";

interface Detected {
  tipo: TipoExame;
  nome: string;
  sistema: SistemaExame;
  laboratorio: string | null;
  data_coleta: string | null;
}

const ocrMessages = [
  "Lendo o documento...",
  "Extraindo texto do exame...",
  "Processando imagem médica...",
];

const analysisMessages = [
  "Lendo seu exame com cuidado...",
  "Identificando os parâmetros...",
  "Preparando sua explicação...",
];

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

export default function UploadPage() {
  const navigate = useNavigate();
  const { addExame, perfil } = useExamStore();
  const [step, setStep] = useState<Step>("choose");
  const [textoLaudo, setTextoLaudo] = useState("");
  const [detected, setDetected] = useState<Detected | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = step === "ocr_processing" || step === "detecting" || step === "analyzing";
  const messages = step === "ocr_processing" ? ocrMessages : analysisMessages;

  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading, messages.length]);

  const runDetect = useCallback(async (texto: string) => {
    setStep("detecting");
    setLoadingMsgIdx(0);
    // Para detectar tipo, basta o início do laudo — evita estourar contexto em Holter, etc.
    const sample = texto.length > 4000 ? texto.slice(0, 4000) : texto;
    try {
      const result = await detectViaEdgeFunction(sample);
      setDetected(result);
      setStep("detected");
    } catch (e) {
      console.warn("Detect fallback:", e);
      setDetected({
        tipo: "outros",
        nome: "Exame Médico",
        sistema: "Outro",
        laboratorio: null,
        data_coleta: null,
      });
      setStep("detected");
    }
  }, []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setOcrError(null);
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");

      if (!isPdf && !isImage) {
        setOcrError("Formato não suportado. Use imagem (JPEG, PNG) ou PDF.");
        return;
      }

      try {
        setStep("ocr_processing");
        setLoadingMsgIdx(0);

        const base64 = await fileToBase64(file);
        const texto = await ocrViaEdgeFunction(base64, file.type, isPdf);

        if (!texto?.trim()) {
          setOcrError("Não foi possível extrair texto do arquivo. Tente colar o texto manualmente.");
          setStep("text");
          return;
        }

        setTextoLaudo(texto);
        await runDetect(texto);
      } catch (e: any) {
        setOcrError(e.message || "Erro ao processar arquivo.");
        setStep("choose");
      }
    },
    [runDetect]
  );

  const openFilePicker = useCallback(
    (accept: string) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) handleFileSelect(file);
      };
      input.click();
    },
    [handleFileSelect]
  );

  const openCamera = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileSelect(file);
    };
    input.click();
  }, [handleFileSelect]);

  const handleAnalyze = async () => {
    if (!detected) return;
    setStep("analyzing");
    setLoadingMsgIdx(0);

    const newId = Date.now().toString();
    const hoje = new Date().toISOString().split("T")[0];

    const newExame = {
      id: newId,
      tipo: detected.tipo,
      nome: detected.nome,
      sistema: detected.sistema,
      data: detected.data_coleta ?? hoje,
      laboratorio: detected.laboratorio ?? "Não informado",
      textoOriginal: textoLaudo,
    };

    try {
      const perfilStr = `${perfil.nome}, ${perfil.sexoBiologico}, nasc. ${perfil.dataNascimento}. Condições: ${perfil.condicoes.join(", ") || "nenhuma"}`;
      const resultado = await explicarLaudo(textoLaudo, perfilStr);

      const savedExame = {
        ...newExame,
        resultado,
        resumo: resultado.resumo_geral,
        sistema: resultado.sistema ?? detected.sistema,
        laboratorio: resultado.origem?.laboratorio ?? detected.laboratorio ?? "Não informado",
        data: resultado.origem?.data_coleta ?? newExame.data,
      };

      addExame(savedExame);
      navigate(`/resultado/${newId}`);

      const { exames } = useExamStore.getState();
      const related = exames.filter(
        (e) => e.id !== newId && e.tipo === savedExame.tipo && e.nome === savedExame.nome
      );
      if (related.length > 0) {
        const all = [...related, savedExame].sort((a, b) => a.data.localeCompare(b.data));
        compararExames(
          all.map((e) => ({ data: e.data, texto: e.textoOriginal, laboratorio: e.laboratorio })),
          perfilStr
        )
          .then((evo) => useExamStore.getState().updateExame(newId, { resultadoEvolutivo: evo }))
          .catch(() => {});
      }
    } catch (e: any) {
      console.error("Análise falhou:", e);
      setOcrError(
        e?.message?.includes("truncad")
          ? "Laudo muito longo. Tente enviar apenas as páginas com os resultados."
          : "Não foi possível gerar a explicação agora. Salvamos o exame como pendente."
      );
      addExame({ ...newExame, resumo: "Análise pendente" });
      navigate(`/resultado/${newId}`);
    }
  };

  return (
    <div className="px-5 pt-14 pb-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground mb-6 active:scale-95 transition-transform"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-2xl font-semibold animate-reveal">Enviar exame</h1>
      <p className="text-sm text-muted-foreground mt-1 animate-reveal animate-reveal-delay-1">
        Tire uma foto, envie o PDF ou cole o texto do laudo.
      </p>

      {ocrError && (
        <div className="mt-4 bg-destructive/10 rounded-lg p-3 flex items-start gap-2 animate-reveal">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{ocrError}</p>
        </div>
      )}

      {step === "choose" && (
        <div className="mt-8 space-y-3 animate-reveal animate-reveal-delay-2">
          <button
            onClick={openCamera}
            className="w-full flex items-center gap-4 p-4 bg-card rounded-lg shadow-sm
              hover:shadow-md active:scale-[0.98] transition-all duration-200 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-sage-light flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Câmera</p>
              <p className="text-xs text-muted-foreground">Fotografe o laudo — OCR automático</p>
            </div>
          </button>

          <button
            onClick={() => openFilePicker(ACCEPT_IMAGE)}
            className="w-full flex items-center gap-4 p-4 bg-card rounded-lg shadow-sm
              hover:shadow-md active:scale-[0.98] transition-all duration-200 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-sage-light flex items-center justify-center">
              <Image className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Galeria</p>
              <p className="text-xs text-muted-foreground">Imagem da galeria — OCR automático</p>
            </div>
          </button>

          <button
            onClick={() => openFilePicker(ACCEPT_PDF)}
            className="w-full flex items-center gap-4 p-4 bg-card rounded-lg shadow-sm
              hover:shadow-md active:scale-[0.98] transition-all duration-200 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-sage-light flex items-center justify-center">
              <FileUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">PDF</p>
              <p className="text-xs text-muted-foreground">Arquivo digital — extração automática</p>
            </div>
          </button>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-3">Ou cole o texto do laudo:</p>
            <button
              onClick={() => {
                setStep("text");
                setTimeout(() => textareaRef.current?.focus(), 100);
              }}
              className="w-full p-4 bg-card rounded-lg shadow-sm text-left hover:shadow-md active:scale-[0.98] transition-all duration-200"
            >
              <p className="text-sm font-medium text-foreground">Colar texto</p>
              <p className="text-xs text-muted-foreground">Cole o conteúdo do seu laudo</p>
            </button>
          </div>
        </div>
      )}

      {step === "text" && (
        <div className="mt-6 animate-reveal">
          <textarea
            ref={textareaRef}
            value={textoLaudo}
            onChange={(e) => setTextoLaudo(e.target.value)}
            placeholder="Cole aqui o texto do seu laudo médico..."
            className="w-full h-48 p-4 bg-card rounded-lg border border-border text-sm
              placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => runDetect(textoLaudo)}
            disabled={!textoLaudo.trim()}
            className="mt-4 w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm
              shadow-md shadow-primary/15 disabled:opacity-40 disabled:shadow-none
              hover:shadow-lg active:scale-[0.97] transition-all duration-200"
          >
            Analisar laudo
          </button>
        </div>
      )}

      {step === "ocr_processing" && (
        <div className="mt-16 text-center animate-reveal">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground mt-4">{ocrMessages[loadingMsgIdx]}</p>
          <div className="mt-3 w-48 h-1 bg-muted rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-primary/40 rounded-full animate-pulse" style={{ width: "70%" }} />
          </div>
        </div>
      )}

      {step === "detecting" && (
        <div className="mt-16 text-center animate-reveal">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground mt-4">Identificando tipo de exame...</p>
        </div>
      )}

      {step === "detected" && detected && (
        <div className="mt-8 animate-reveal">
          <div className="bg-sage-light rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{detected.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {detected.sistema} · {detected.tipo}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              {detected.laboratorio && (
                <div className="bg-background/60 rounded-md px-2.5 py-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Laboratório</p>
                  <p className="text-xs font-medium text-foreground truncate">{detected.laboratorio}</p>
                </div>
              )}
              {detected.data_coleta && (
                <div className="bg-background/60 rounded-md px-2.5 py-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Data</p>
                  <p className="text-xs font-medium text-foreground">
                    {new Date(detected.data_coleta + "T12:00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {textoLaudo && (
            <div className="bg-card rounded-lg p-3 mb-4 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                Texto extraído
              </p>
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {textoLaudo.slice(0, 200)}{textoLaudo.length > 200 ? "..." : ""}
              </p>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm
              shadow-md shadow-primary/15 hover:shadow-lg active:scale-[0.97] transition-all duration-200"
          >
            Gerar explicação
          </button>

          <button
            onClick={() => {
              setStep("text");
              setTimeout(() => textareaRef.current?.focus(), 100);
            }}
            className="w-full mt-2 text-center text-xs text-muted-foreground py-2 active:scale-95 transition-transform"
          >
            Editar texto extraído
          </button>
        </div>
      )}

      {step === "analyzing" && (
        <div className="mt-16 text-center animate-reveal">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground mt-4">{analysisMessages[loadingMsgIdx]}</p>
          <div className="mt-3 w-48 h-1 bg-muted rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-primary/40 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}
    </div>
  );
}

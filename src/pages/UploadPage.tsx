import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Image, FileUp, Check, Loader2 } from "lucide-react";
import { useExamStore } from "@/stores/examStore";
import { explicarLaudo, compararExames } from "@/lib/claude";
import type { TipoExame } from "@/types/health";

const uploadOptions = [
  { id: "camera", icon: Camera, label: "Câmera", desc: "Tire uma foto do laudo" },
  { id: "gallery", icon: Image, label: "Galeria", desc: "Escolha uma imagem salva" },
  { id: "pdf", icon: FileUp, label: "PDF", desc: "Envie o arquivo digital" },
] as const;

const tipoMap: Record<string, { tipo: TipoExame; nome: string }> = {
  hemograma: { tipo: "sangue", nome: "Hemograma" },
  colesterol: { tipo: "sangue", nome: "Perfil Lipídico" },
  glicemia: { tipo: "sangue", nome: "Glicemia" },
  "raio-x": { tipo: "imagem", nome: "Raio-X" },
  tomografia: { tipo: "imagem", nome: "Tomografia" },
  ressonância: { tipo: "imagem", nome: "Ressonância Magnética" },
  ultrassom: { tipo: "imagem", nome: "Ultrassonografia" },
};

function detectType(text: string): { tipo: TipoExame; nome: string } {
  const lower = text.toLowerCase();
  for (const [keyword, info] of Object.entries(tipoMap)) {
    if (lower.includes(keyword)) return info;
  }
  return { tipo: "outros", nome: "Exame Médico" };
}

const loadingMessages = [
  "Lendo seu exame com cuidado...",
  "Identificando os parâmetros...",
  "Preparando sua explicação...",
];

export default function UploadPage() {
  const navigate = useNavigate();
  const { addExame, perfil } = useExamStore();
  const [step, setStep] = useState<"choose" | "text" | "detecting" | "detected" | "analyzing">("choose");
  const [textoLaudo, setTextoLaudo] = useState("");
  const [detected, setDetected] = useState<{ tipo: TipoExame; nome: string } | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Rotating messages
  useEffect(() => {
    if (step !== "analyzing" && step !== "detecting") return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [step]);

  const handleUploadOption = () => {
    setStep("text");
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleDetect = () => {
    if (!textoLaudo.trim()) return;
    setStep("detecting");
    setLoadingMsgIdx(0);
    setTimeout(() => {
      const det = detectType(textoLaudo);
      setDetected(det);
      setStep("detected");
    }, 1500);
  };

  const handleAnalyze = async () => {
    if (!detected) return;
    setStep("analyzing");
    setLoadingMsgIdx(0);

    const newExame = {
      id: Date.now().toString(),
      tipo: detected.tipo,
      nome: detected.nome,
      data: new Date().toISOString().split("T")[0],
      laboratorio: "Não informado",
      textoOriginal: textoLaudo,
    };

    try {
      const perfilStr = `${perfil.nome}, ${perfil.sexoBiologico}, nasc. ${perfil.dataNascimento}. Condições: ${perfil.condicoes.join(", ") || "nenhuma"}`;
      const resultado = await explicarLaudo(textoLaudo, perfilStr);
      const savedExame = {
        ...newExame,
        resultado,
        resumo: resultado.resumo_geral,
        sistema: resultado.sistema,
        laboratorio: resultado.origem?.laboratorio || "Não informado",
        data: resultado.origem?.data_coleta || newExame.data,
      };
      addExame(savedExame);
      navigate(`/resultado/${newExame.id}`);

      // Background: generate evolutivo if previous exams exist
      const { exames } = useExamStore.getState();
      const related = exames.filter(
        (e) => e.id !== newExame.id && e.tipo === savedExame.tipo && e.nome === savedExame.nome
      );
      if (related.length > 0) {
        const allRelated = [...related, savedExame].sort((a, b) => a.data.localeCompare(b.data));
        compararExames(
          allRelated.map((e) => ({ data: e.data, texto: e.textoOriginal, laboratorio: e.laboratorio })),
          perfilStr
        ).then((evoResult) => {
          useExamStore.getState().updateExame(newExame.id, { resultadoEvolutivo: evoResult });
        }).catch(() => {});
      }
    } catch {
      addExame({ ...newExame, resumo: "Análise pendente" });
      navigate(`/resultado/${newExame.id}`);
    }
  };

  return (
    <div className="px-5 pt-14 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-6 active:scale-95 transition-transform">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-2xl font-semibold animate-reveal">Enviar exame</h1>
      <p className="text-sm text-muted-foreground mt-1 animate-reveal animate-reveal-delay-1">
        Escolha como enviar seu laudo médico.
      </p>

      {step === "choose" && (
        <div className="mt-8 space-y-3 animate-reveal animate-reveal-delay-2">
          {uploadOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={handleUploadOption}
              className="w-full flex items-center gap-4 p-4 bg-card rounded-lg shadow-sm
                hover:shadow-md active:scale-[0.98] transition-all duration-200 text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-sage-light flex items-center justify-center">
                <opt.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-3">Ou cole o texto do laudo:</p>
            <button
              onClick={() => { setStep("text"); setTimeout(() => textareaRef.current?.focus(), 100); }}
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
            onClick={handleDetect}
            disabled={!textoLaudo.trim()}
            className="mt-4 w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm
              shadow-md shadow-primary/15 disabled:opacity-40 disabled:shadow-none
              hover:shadow-lg active:scale-[0.97] transition-all duration-200"
          >
            Analisar laudo
          </button>
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
          <div className="bg-sage-light rounded-lg p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{detected.nome} detectado</p>
              <p className="text-xs text-muted-foreground">Tipo: {detected.tipo}</p>
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            className="mt-6 w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm
              shadow-md shadow-primary/15
              hover:shadow-lg active:scale-[0.97] transition-all duration-200"
          >
            Gerar explicação
          </button>
        </div>
      )}

      {step === "analyzing" && (
        <div className="mt-16 text-center animate-reveal">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground mt-4">{loadingMessages[loadingMsgIdx]}</p>
          <div className="mt-3 w-48 h-1 bg-muted rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-primary/40 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}
    </div>
  );
}

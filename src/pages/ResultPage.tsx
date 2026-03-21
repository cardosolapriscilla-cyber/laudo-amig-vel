import { useParams, useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import { ArrowLeft, Loader2, CircleCheck, AlertTriangle, Clock, HelpCircle } from "lucide-react";
import { explicarLaudo } from "@/lib/claude";
import { useState, useEffect } from "react";
import type { ResultadoExplicador, Achado } from "@/types/health";

const statusConfig = {
  normal: { icon: CircleCheck, label: "Dentro da normalidade", class: "status-normal" },
  atencao: { icon: AlertTriangle, label: "Atenção", class: "status-atencao" },
  acompanhamento: { icon: Clock, label: "Requer acompanhamento", class: "status-acompanhamento" },
};

function FindingCard({ achado }: { achado: Achado }) {
  const config = statusConfig[achado.status];
  const Icon = config.icon;

  return (
    <div className="bg-card rounded-lg p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`rounded-md p-1.5 mt-0.5 ${config.class}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{achado.parametro}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${config.class}`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{achado.explicacao_simples}</p>
          {achado.analogia && (
            <div className="mt-3 bg-sage-light rounded-md p-3">
              <p className="text-xs text-sage-muted italic">💡 {achado.analogia}</p>
            </div>
          )}
          {achado.pergunta_medico && (
            <div className="mt-2 flex items-start gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">{achado.pergunta_medico}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GlossarySheet({ glossario }: { glossario: { termo: string; definicao: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!glossario?.length) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-primary underline underline-offset-2 active:scale-95 transition-transform"
      >
        Ver glossário ({glossario.length} termos)
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-foreground/20" />
          <div
            className="relative w-full max-w-md bg-background rounded-t-2xl p-5 pb-8 animate-reveal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-4">Glossário</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {glossario.map((g) => (
                <div key={g.termo}>
                  <p className="text-sm font-medium text-foreground">{g.termo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{g.definicao}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { exames, updateExame } = useExamStore();
  const exame = exames.find((e) => e.id === id);
  const [resultado, setResultado] = useState<ResultadoExplicador | null>(exame?.resultado ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check for previous exams of same type for evolution link
  const previousExams = exames.filter(
    (e) => e.id !== id && e.tipo === exame?.tipo && e.nome === exame?.nome
  );

  useEffect(() => {
    if (exame && !resultado) {
      setLoading(true);
      explicarLaudo(exame.textoOriginal)
        .then((res) => {
          setResultado(res);
          updateExame(exame.id, { resultado: res, resumo: res.resumo_geral });
        })
        .catch(() => setError("Não foi possível analisar o laudo. Verifique sua chave de API."))
        .finally(() => setLoading(false));
    }
  }, [exame?.id]);

  if (!exame) {
    return (
      <div className="px-5 pt-14">
        <p className="text-muted-foreground">Exame não encontrado.</p>
        <button onClick={() => navigate("/")} className="text-primary text-sm mt-2 underline">Voltar</button>
      </div>
    );
  }

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="px-5 pt-14 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-6 active:scale-95 transition-transform">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      {/* Header */}
      <div className="animate-reveal">
        <h1 className="text-2xl font-semibold">{exame.nome}</h1>
        <p className="text-sm text-muted-foreground mt-1">{formatDate(exame.data)} · {exame.laboratorio}</p>
      </div>

      {/* Evolution link */}
      {previousExams.length > 0 && (
        <button
          onClick={() => navigate(`/evolucao/${exame.id}`)}
          className="mt-4 w-full bg-sage-light text-primary text-sm font-medium py-3 rounded-lg
            active:scale-[0.98] transition-all duration-200 animate-reveal animate-reveal-delay-1"
        >
          📈 Ver evolução comparada ({previousExams.length + 1} exames)
        </button>
      )}

      {loading && (
        <div className="mt-16 text-center animate-reveal">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground mt-4">Lendo seu exame com cuidado...</p>
        </div>
      )}

      {error && (
        <div className="mt-8 bg-destructive/10 rounded-lg p-4 animate-reveal">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {resultado && (
        <div className="mt-6 space-y-6">
          {/* Summary */}
          <div className="bg-sage-light rounded-lg p-4 animate-reveal animate-reveal-delay-1">
            <p className="text-sm text-foreground leading-relaxed">{resultado.resumo_geral}</p>
          </div>

          {/* Findings */}
          <div className="animate-reveal animate-reveal-delay-2">
            <h2 className="text-lg font-semibold mb-3">O que encontramos</h2>
            <div className="space-y-3">
              {resultado.achados.map((achado, i) => (
                <div key={i} className={`animate-reveal animate-reveal-delay-${Math.min(i + 1, 4)}`}>
                  <FindingCard achado={achado} />
                </div>
              ))}
            </div>
          </div>

          {/* Glossary */}
          {resultado.glossario?.length > 0 && (
            <div className="animate-reveal animate-reveal-delay-3">
              <GlossarySheet glossario={resultado.glossario} />
            </div>
          )}

          {/* Questions for doctor */}
          {resultado.perguntas_para_medico?.length > 0 && (
            <div className="animate-reveal animate-reveal-delay-4">
              <h2 className="text-lg font-semibold mb-3">Perguntas para levar ao médico</h2>
              <div className="space-y-2">
                {resultado.perguntas_para_medico.map((q, i) => (
                  <div key={i} className="bg-card rounded-lg p-3 shadow-sm flex items-start gap-2">
                    <span className="text-primary font-medium text-sm">{i + 1}.</span>
                    <p className="text-sm text-foreground">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="border-t pt-4 mt-8">
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              ⚕️ Este app não substitui consulta médica. As explicações são informativas e baseadas no texto do laudo fornecido.
            </p>
          </div>
        </div>
      )}

      {!loading && !resultado && !error && (
        <div className="mt-8 animate-reveal">
          <div className="bg-card rounded-lg p-4 shadow-sm">
            <h2 className="text-sm font-medium mb-2">Texto original do laudo</h2>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{exame.textoOriginal}</p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              explicarLaudo(exame.textoOriginal)
                .then((res) => { setResultado(res); updateExame(exame.id, { resultado: res, resumo: res.resumo_geral }); })
                .catch(() => setError("Erro ao analisar"))
                .finally(() => setLoading(false));
            }}
            className="mt-4 w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm
              shadow-md shadow-primary/15 active:scale-[0.97] transition-all duration-200"
          >
            Gerar explicação com IA
          </button>
        </div>
      )}
    </div>
  );
}

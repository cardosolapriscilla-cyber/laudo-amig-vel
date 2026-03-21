import { useParams, useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { compararExames } from "@/lib/claude";
import { useState, useEffect } from "react";
import type { ResultadoEvolutivo, ParametroEvolutivo } from "@/types/health";

const tendenciaConfig = {
  melhora: { icon: TrendingUp, label: "Melhora", color: "text-primary", bg: "bg-sage-light" },
  estavel: { icon: Minus, label: "Estável", color: "text-muted-foreground", bg: "bg-muted" },
  atencao: { icon: AlertTriangle, label: "Atenção", color: "text-[hsl(var(--attention))]", bg: "bg-[hsl(var(--attention-bg))]" },
  piora: { icon: TrendingDown, label: "Piora", color: "text-destructive", bg: "bg-destructive/10" },
};

function ParametroCard({ param }: { param: ParametroEvolutivo }) {
  const config = tendenciaConfig[param.tendencia];
  const Icon = config.icon;
  const lastTwo = param.valores.slice(-2);

  return (
    <div className="bg-card rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">{param.nome}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${config.bg} ${config.color}`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
      </div>

      {lastTwo.length === 2 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <span>{lastTwo[0].valor} {lastTwo[0].unidade}</span>
          <span className="text-xs">→</span>
          <span className="text-foreground font-medium">{lastTwo[1].valor} {lastTwo[1].unidade}</span>
          <span className={`text-xs font-medium ${config.color}`}>
            {param.variacao_percentual > 0 ? "+" : ""}{param.variacao_percentual.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Reference bar */}
      {lastTwo.length > 0 && lastTwo[0].referencia_min != null && (
        <div className="mt-3">
          <div className="h-2 bg-muted rounded-full relative overflow-hidden">
            {lastTwo.map((v, i) => {
              const range = v.referencia_max - v.referencia_min;
              const pos = Math.max(0, Math.min(100, ((v.valor - v.referencia_min) / range) * 100));
              return (
                <div
                  key={i}
                  className={`absolute top-0 w-2 h-2 rounded-full ${i === lastTwo.length - 1 ? "bg-primary" : "bg-muted-foreground/40"}`}
                  style={{ left: `calc(${pos}% - 4px)` }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{lastTwo[0].referencia_min}</span>
            <span>{lastTwo[0].referencia_max}</span>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{param.comentario}</p>
    </div>
  );
}

export default function EvolutionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { exames } = useExamStore();
  const currentExam = exames.find((e) => e.id === id);

  const relatedExams = exames
    .filter((e) => e.tipo === currentExam?.tipo && e.nome === currentExam?.nome)
    .sort((a, b) => a.data.localeCompare(b.data));

  const [resultado, setResultado] = useState<ResultadoEvolutivo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (relatedExams.length >= 2 && !resultado) {
      setLoading(true);
      compararExames(relatedExams.map((e) => ({ data: e.data, texto: e.textoOriginal })))
        .then(setResultado)
        .catch(() => setError("Não foi possível comparar os exames."))
        .finally(() => setLoading(false));
    }
  }, [currentExam?.id]);

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  if (!currentExam) {
    return (
      <div className="px-5 pt-14">
        <p className="text-muted-foreground">Exame não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-14 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-6 active:scale-95 transition-transform">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-2xl font-semibold animate-reveal">Laudo Evolutivo</h1>
      <p className="text-sm text-muted-foreground mt-1 animate-reveal animate-reveal-delay-1">
        {currentExam.nome} — comparação de {relatedExams.length} exames
      </p>

      {/* Timeline dots */}
      <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2 animate-reveal animate-reveal-delay-2">
        {relatedExams.map((e, i) => (
          <div key={e.id} className="flex items-center gap-2 shrink-0">
            <div className={`w-3 h-3 rounded-full ${e.id === id ? "bg-primary" : "bg-border"}`} />
            <span className="text-xs text-muted-foreground">{formatDate(e.data)}</span>
            {i < relatedExams.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {loading && (
        <div className="mt-16 text-center animate-reveal">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground mt-4">Comparando seus exames...</p>
        </div>
      )}

      {error && (
        <div className="mt-8 bg-destructive/10 rounded-lg p-4 animate-reveal">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {resultado && (
        <div className="mt-6 space-y-6">
          <div className="bg-sage-light rounded-lg p-4 animate-reveal animate-reveal-delay-2">
            <p className="text-sm text-foreground leading-relaxed">{resultado.narrativa_geral}</p>
          </div>

          <div className="animate-reveal animate-reveal-delay-3">
            <h2 className="text-lg font-semibold mb-3">Parâmetros comparados</h2>
            <div className="space-y-3">
              {resultado.parametros.map((param, i) => (
                <ParametroCard key={i} param={param} />
              ))}
            </div>
          </div>

          {resultado.alertas?.length > 0 && (
            <div className="animate-reveal animate-reveal-delay-4">
              <h2 className="text-lg font-semibold mb-3">Alertas</h2>
              <div className="space-y-2">
                {resultado.alertas.map((a, i) => (
                  <div key={i} className="bg-[hsl(var(--attention-bg))] rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[hsl(var(--attention))] mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultado.proximo_passo && (
            <div className="bg-card rounded-lg p-4 shadow-sm border-l-4 border-primary animate-reveal animate-reveal-delay-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Próximo passo</p>
              <p className="text-sm text-foreground">{resultado.proximo_passo}</p>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              ⚕️ Este app não substitui consulta médica.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

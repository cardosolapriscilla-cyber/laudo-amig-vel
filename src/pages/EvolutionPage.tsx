import { useParams, useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { compararExames } from "@/lib/claude";
import { useState, useEffect } from "react";
import type { ResultadoEvolutivo, ParametroEvolutivo, EvolucaoOrgao } from "@/types/health";

const tendenciaConfig = {
  melhora: { icon: TrendingUp, label: "Melhora", color: "text-primary", bg: "bg-sage-light" },
  estavel: { icon: Minus, label: "Estável", color: "text-muted-foreground", bg: "bg-muted" },
  atencao: { icon: AlertTriangle, label: "Atenção", color: "text-[hsl(var(--attention))]", bg: "bg-[hsl(var(--attention-bg))]" },
  piora: { icon: TrendingDown, label: "Piora", color: "text-[hsl(var(--follow-up))]", bg: "bg-[hsl(var(--follow-up-bg))]" },
};

// Mini sparkline SVG
function Sparkline({ valores }: { valores: { data: string; valor: number; referencia_min?: number | null; referencia_max?: number | null }[] }) {
  if (valores.length < 2) return null;

  const w = 120;
  const h = 32;
  const padding = 4;
  const vals = valores.map((v) => v.valor);
  const min = Math.min(...vals) * 0.9;
  const max = Math.max(...vals) * 1.1;
  const range = max - min || 1;

  const points = valores.map((v, i) => {
    const x = padding + (i / (valores.length - 1)) * (w - 2 * padding);
    const y = h - padding - ((v.valor - min) / range) * (h - 2 * padding);
    return `${x},${y}`;
  });

  // Reference band
  const refMin = valores[0]?.referencia_min;
  const refMax = valores[0]?.referencia_max;
  let refY1: number | null = null;
  let refY2: number | null = null;
  if (refMin != null && refMax != null) {
    refY1 = h - padding - ((refMax - min) / range) * (h - 2 * padding);
    refY2 = h - padding - ((refMin - min) / range) * (h - 2 * padding);
  }

  return (
    <svg width={w} height={h} className="shrink-0">
      {refY1 != null && refY2 != null && (
        <rect x={0} y={refY1} width={w} height={refY2 - refY1} fill="hsl(var(--sage-light))" rx={2} />
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {valores.map((v, i) => {
        const x = padding + (i / (valores.length - 1)) * (w - 2 * padding);
        const y = h - padding - ((v.valor - min) / range) * (h - 2 * padding);
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={1.5} />
        );
      })}
    </svg>
  );
}

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

      <div className="flex items-center gap-4">
        <Sparkline valores={param.valores} />
        <div className="flex-1">
          {lastTwo.length === 2 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{lastTwo[0].valor} {param.unidade}</span>
              <span className="text-xs">→</span>
              <span className="text-foreground font-medium">{lastTwo[1].valor} {param.unidade}</span>
            </div>
          )}
          <span className={`text-xs font-medium ${config.color}`}>
            {param.variacao_percentual > 0 ? "+" : ""}{param.variacao_percentual.toFixed(1)}%
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{param.comentario}</p>
    </div>
  );
}

function OrganEvolution({ evolucao }: { evolucao: EvolucaoOrgao }) {
  return (
    <div className="bg-card rounded-lg p-4 shadow-sm">
      <p className="text-sm font-medium text-foreground mb-3">{evolucao.orgao}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {evolucao.historico.map((h, i) => {
          const currentIdx = evolucao.trilha.indexOf(h.estado);
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground text-xs">→</span>}
              <div className="text-center">
                <span className={`inline-block text-[10px] px-2 py-1 rounded-full ${
                  currentIdx <= 0 ? "bg-sage-light text-sage-muted" :
                  currentIdx === 1 ? "bg-[hsl(var(--attention-bg))] text-[hsl(var(--attention))]" :
                  "bg-[hsl(var(--follow-up-bg))] text-[hsl(var(--follow-up))]"
                } font-medium`}>
                  {h.estado}
                </span>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {new Date(h.data + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {/* Full trail */}
      <div className="mt-3 flex gap-1 flex-wrap">
        {evolucao.trilha.map((step) => {
          const isInHistory = evolucao.historico.some((h) => h.estado === step);
          const latest = evolucao.historico[evolucao.historico.length - 1]?.estado;
          return (
            <span
              key={step}
              className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                step === latest ? "bg-primary text-primary-foreground font-medium" :
                isInHistory ? "bg-muted text-muted-foreground" :
                "bg-muted/50 text-muted-foreground/40"
              }`}
            >
              {step}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function EvolutionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { exames, perfil } = useExamStore();
  const currentExam = exames.find((e) => e.id === id);

  const relatedExams = exames
    .filter((e) => e.tipo === currentExam?.tipo && e.nome === currentExam?.nome)
    .sort((a, b) => a.data.localeCompare(b.data));

  const [resultado, setResultado] = useState<ResultadoEvolutivo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);

  useEffect(() => {
    if (relatedExams.length >= 2 && !resultado) {
      setLoading(true);
      const perfilStr = `${perfil.nome}, ${perfil.sexoBiologico}, nasc. ${perfil.dataNascimento}`;
      compararExames(
        relatedExams.map((e) => ({ data: e.data, texto: e.textoOriginal, laboratorio: e.laboratorio })),
        perfilStr
      )
        .then(setResultado)
        .catch(() => setError("Não foi possível comparar os exames."))
        .finally(() => setLoading(false));
    }
  }, [currentExam?.id]);

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  // Get unique systems for filter
  const systems = resultado?.parametros
    ? [...new Set(resultado.parametros.map((p) => p.sistema).filter(Boolean))]
    : [];

  const filteredParams = resultado?.parametros?.filter(
    (p) => !selectedSystem || p.sistema === selectedSystem
  ) ?? [];

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
          {/* Narrative */}
          <div className="bg-sage-light rounded-lg p-4 animate-reveal animate-reveal-delay-2">
            <p className="text-sm text-foreground leading-relaxed font-serif">{resultado.narrativa_geral}</p>
          </div>

          {/* System filter chips */}
          {systems.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 animate-reveal animate-reveal-delay-3">
              <button
                onClick={() => setSelectedSystem(null)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                  !selectedSystem ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
                }`}
              >
                Todos
              </button>
              {systems.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSystem(s === selectedSystem ? null : s!)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                    selectedSystem === s ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Parameters with sparklines */}
          <div className="animate-reveal animate-reveal-delay-3">
            <h2 className="text-lg font-semibold mb-3">Parâmetros comparados</h2>
            <div className="space-y-3">
              {filteredParams.map((param, i) => (
                <ParametroCard key={i} param={param} />
              ))}
            </div>
          </div>

          {/* Organ evolution */}
          {resultado.evolucao_orgao && resultado.evolucao_orgao.length > 0 && (
            <div className="animate-reveal animate-reveal-delay-4">
              <h2 className="text-lg font-semibold mb-3">Evolução por órgão</h2>
              <div className="space-y-3">
                {resultado.evolucao_orgao.map((evo, i) => (
                  <OrganEvolution key={i} evolucao={evo} />
                ))}
              </div>
            </div>
          )}

          {/* Alerts */}
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

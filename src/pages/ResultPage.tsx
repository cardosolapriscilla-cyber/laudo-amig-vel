import { useParams, useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import { ArrowLeft, Loader2, CircleCheck, AlertTriangle, Clock, HelpCircle, Copy, Check, Share2, Stethoscope } from "lucide-react";
import { explicarLaudo, compararExames } from "@/lib/claude";
import { useState, useEffect } from "react";
import type { ResultadoExplicador, ResultadoEvolutivo, ParametroEvolutivo, EvolucaoOrgao, Achado } from "@/types/health";
import CheckinSheet from "@/components/CheckinSheet";
import ShareWithDoctorSheet from "@/components/ShareWithDoctorSheet";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const statusConfig = {
  normal: { icon: CircleCheck, label: "Dentro do esperado", class: "status-normal" },
  atencao: { icon: AlertTriangle, label: "Merece atenção", class: "status-atencao" },
  acompanhamento: { icon: Clock, label: "Acompanhamento recomendado", class: "status-acompanhamento" },
};

const loadingMessages = [
  "Lendo seu exame com cuidado...",
  "Identificando os parâmetros...",
  "Preparando sua explicação...",
];

// --- Régua de referência ---
function ReferenceBar({ valor, referencia }: { valor: string; referencia: string }) {
  // Try to parse numeric value and reference range
  const numVal = parseFloat(valor?.replace(/[^\d.,]/g, "").replace(",", ".") || "");
  const refMatch = referencia?.match(/([\d.,]+)\s*[-–a]\s*([\d.,]+)/);
  const ltMatch = referencia?.match(/<\s*([\d.,]+)/);
  const gtMatch = referencia?.match(/>\s*([\d.,]+)/);

  let min: number, max: number;
  if (refMatch) {
    min = parseFloat(refMatch[1].replace(",", "."));
    max = parseFloat(refMatch[2].replace(",", "."));
  } else if (ltMatch) {
    min = 0;
    max = parseFloat(ltMatch[1].replace(",", "."));
  } else if (gtMatch) {
    min = parseFloat(gtMatch[1].replace(",", "."));
    max = min * 2;
  } else {
    return null;
  }

  if (isNaN(numVal) || isNaN(min) || isNaN(max)) return null;

  const range = max - min;
  const extendedMin = min - range * 0.2;
  const extendedMax = max + range * 0.2;
  const extRange = extendedMax - extendedMin;
  const pos = Math.max(0, Math.min(100, ((numVal - extendedMin) / extRange) * 100));
  const refStart = ((min - extendedMin) / extRange) * 100;
  const refEnd = ((max - extendedMin) / extRange) * 100;

  return (
    <div className="mt-3">
      <div className="h-2 bg-muted rounded-full relative overflow-hidden">
        <div
          className="absolute top-0 h-full bg-sage-light"
          style={{ left: `${refStart}%`, width: `${refEnd - refStart}%` }}
        />
        <div
          className="absolute top-0 w-2.5 h-2.5 rounded-full bg-primary -translate-y-[1px]"
          style={{ left: `calc(${pos}% - 5px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{min}</span>
        <span className="font-medium text-foreground">{valor}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// --- Trilha discreta ---
function DiscretePath({ opcoes, atual }: { opcoes: string[]; atual: string }) {
  const currentIdx = opcoes.indexOf(atual);

  return (
    <div className="mt-3 flex gap-1 flex-wrap">
      {opcoes.map((opt, i) => (
        <span
          key={opt}
          className={`text-[10px] px-2 py-1 rounded-full transition-all
            ${i === currentIdx
              ? "bg-primary text-primary-foreground font-medium shadow-sm"
              : "bg-muted text-muted-foreground/60"
            }`}
        >
          {opt}
        </span>
      ))}
    </div>
  );
}

// --- Achado expandível ---
function FindingCard({ achado }: { achado: Achado }) {
  const config = statusConfig[achado.status];
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(achado.status !== "normal");

  return (
    <div className="bg-card rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 active:bg-muted/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-md p-1.5 mt-0.5 ${config.class}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground">{achado.parametro}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${config.class}`}>
                {config.label}
              </span>
            </div>
            {achado.valor && (
              <p className="text-xs text-muted-foreground mt-1">{achado.valor}</p>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-reveal">
          <p className="text-sm text-muted-foreground leading-relaxed">{achado.explicacao_simples}</p>

          {achado.analogia && (
            <div className="bg-sage-light rounded-md p-3 border-l-3 border-primary">
              <p className="text-xs text-sage-muted italic">💡 {achado.analogia}</p>
            </div>
          )}

          {achado.tipo_visualizacao === "regua" && achado.valor && achado.referencia && (
            <ReferenceBar valor={achado.valor} referencia={achado.referencia} />
          )}

          {achado.tipo_visualizacao === "trilha_discreta" && achado.estado_discreto && (
            <DiscretePath opcoes={achado.estado_discreto.opcoes} atual={achado.estado_discreto.atual} />
          )}

          {achado.pergunta_medico && (
            <div className="flex items-start gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">{achado.pergunta_medico}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Glossário inline ---
function GlossaryChips({ glossario }: { glossario: { termo: string; definicao: string }[] }) {
  const [openTermo, setOpenTermo] = useState<string | null>(null);
  if (!glossario?.length) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Glossário</h2>
      <div className="flex flex-wrap gap-2">
        {glossario.map((g) => (
          <div key={g.termo} className="relative">
            <button
              onClick={() => setOpenTermo(openTermo === g.termo ? null : g.termo)}
              className={`text-xs px-3 py-1.5 rounded-full transition-all active:scale-95
                ${openTermo === g.termo
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground border border-border hover:bg-muted"
                }`}
            >
              {g.termo}
            </button>
            {openTermo === g.termo && (
              <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg p-3 shadow-md z-10 min-w-[200px] max-w-[280px] animate-reveal">
                <p className="text-xs text-muted-foreground">{g.definicao}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
// --- Evolution tab components (inline) ---

const tendenciaConfig = {
  melhora: { icon: TrendingUp, label: "Melhora", color: "text-primary", bg: "bg-sage-light" },
  estavel: { icon: Minus, label: "Estável", color: "text-muted-foreground", bg: "bg-muted" },
  atencao: { icon: AlertTriangle, label: "Atenção", color: "text-[hsl(var(--attention))]", bg: "bg-[hsl(var(--attention-bg))]" },
  piora: { icon: TrendingDown, label: "Piora", color: "text-[hsl(var(--follow-up))]", bg: "bg-[hsl(var(--follow-up-bg))]" },
};

function Sparkline({ valores }: { valores: { data: string; valor: number; referencia_min?: number | null; referencia_max?: number | null }[] }) {
  if (valores.length < 2) return null;
  const w = 120, h = 32, padding = 4;
  const vals = valores.map((v) => v.valor);
  const min = Math.min(...vals) * 0.9;
  const max = Math.max(...vals) * 1.1;
  const range = max - min || 1;
  const points = valores.map((v, i) => {
    const x = padding + (i / (valores.length - 1)) * (w - 2 * padding);
    const y = h - padding - ((v.valor - min) / range) * (h - 2 * padding);
    return `${x},${y}`;
  });
  const refMin = valores[0]?.referencia_min;
  const refMax = valores[0]?.referencia_max;
  let refY1: number | null = null, refY2: number | null = null;
  if (refMin != null && refMax != null) {
    refY1 = h - padding - ((refMax - min) / range) * (h - 2 * padding);
    refY2 = h - padding - ((refMin - min) / range) * (h - 2 * padding);
  }
  return (
    <svg width={w} height={h} className="shrink-0">
      {refY1 != null && refY2 != null && <rect x={0} y={refY1} width={w} height={refY2 - refY1} fill="hsl(var(--sage-light))" rx={2} />}
      <polyline points={points.join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {valores.map((v, i) => {
        const x = padding + (i / (valores.length - 1)) * (w - 2 * padding);
        const y = h - padding - ((v.valor - min) / range) * (h - 2 * padding);
        return <circle key={i} cx={x} cy={y} r={3} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={1.5} />;
      })}
    </svg>
  );
}

function EvoParametroCard({ param }: { param: ParametroEvolutivo }) {
  const config = tendenciaConfig[param.tendencia];
  const Icon = config.icon;
  const lastTwo = param.valores.slice(-2);
  return (
    <div className="bg-card rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">{param.nome}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${config.bg} ${config.color}`}>
          <Icon className="w-3 h-3" /> {config.label}
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

function EvoOrganCard({ evolucao }: { evolucao: EvolucaoOrgao }) {
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
                } font-medium`}>{h.estado}</span>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {new Date(h.data + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvolutionTabContent({ resultadoEvolutivo, loading, exame, previousExams }: {
  resultadoEvolutivo: ResultadoEvolutivo | null;
  loading: boolean;
  exame: any;
  previousExams: any[];
}) {
  if (loading || !resultadoEvolutivo) {
    return (
      <div className="mt-16 text-center animate-reveal">
        <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
        <p className="text-sm text-muted-foreground mt-4">Preparando sua evolução...</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="bg-sage-light rounded-lg p-4 animate-reveal">
        <p className="text-sm text-foreground leading-relaxed font-serif">{resultadoEvolutivo.narrativa_geral}</p>
      </div>

      {resultadoEvolutivo.parametros?.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-1">
          <h2 className="text-lg font-semibold mb-3">Parâmetros comparados</h2>
          <div className="space-y-3">
            {resultadoEvolutivo.parametros.map((param, i) => (
              <EvoParametroCard key={i} param={param} />
            ))}
          </div>
        </div>
      )}

      {resultadoEvolutivo.evolucao_orgao && resultadoEvolutivo.evolucao_orgao.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-2">
          <h2 className="text-lg font-semibold mb-3">Evolução por órgão</h2>
          <div className="space-y-3">
            {resultadoEvolutivo.evolucao_orgao.map((evo, i) => (
              <EvoOrganCard key={i} evolucao={evo} />
            ))}
          </div>
        </div>
      )}

      {resultadoEvolutivo.alertas?.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-3">
          <h2 className="text-lg font-semibold mb-3">Alertas</h2>
          <div className="space-y-2">
            {resultadoEvolutivo.alertas.map((a, i) => (
              <div key={i} className="bg-[hsl(var(--attention-bg))] rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[hsl(var(--attention))] mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">{a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {resultadoEvolutivo.proximo_passo && (
        <div className="bg-card rounded-lg p-4 shadow-sm border-l-4 border-primary animate-reveal animate-reveal-delay-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Próximo passo</p>
          <p className="text-sm text-foreground">{resultadoEvolutivo.proximo_passo}</p>
        </div>
      )}

      <div className="border-t pt-4">
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          ⚕️ Este app não substitui consulta médica.
        </p>
      </div>
    </div>
  );
}

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { exames, updateExame, perfil } = useExamStore();
  const exame = exames.find((e) => e.id === id);
  const [resultado, setResultado] = useState<ResultadoExplicador | null>(exame?.resultado ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeTab, setActiveTab] = useState<"explicacao" | "evolucao">("explicacao");

  const previousExams = exames.filter(
    (e) => e.id !== id && e.tipo === exame?.tipo && e.nome === exame?.nome
  );
  const hasEvolution = previousExams.length > 0;
  const [evoLoading, setEvoLoading] = useState(false);

  // Poll for evolutivo result (generated in background by UploadPage)
  const resultadoEvolutivo = exame?.resultadoEvolutivo ?? null;

  // If has previous exams but no evolutivo yet, trigger generation
  useEffect(() => {
    if (hasEvolution && !resultadoEvolutivo && exame && activeTab === "evolucao" && !evoLoading) {
      setEvoLoading(true);
      const allRelated = [...previousExams, exame].sort((a, b) => a.data.localeCompare(b.data));
      const perfilStr = `${perfil.nome}, ${perfil.sexoBiologico}, nasc. ${perfil.dataNascimento}`;
      compararExames(
        allRelated.map((e) => ({ data: e.data, texto: e.textoOriginal, laboratorio: e.laboratorio })),
        perfilStr
      ).then((res) => {
        updateExame(exame.id, { resultadoEvolutivo: res });
      }).catch(() => {})
        .finally(() => setEvoLoading(false));
    }
  }, [activeTab, hasEvolution, resultadoEvolutivo?.narrativa_geral]);

  // Rotating loading messages
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-analyze
  useEffect(() => {
    if (exame && !resultado) {
      setLoading(true);
      const perfilStr = `${perfil.nome}, ${perfil.sexoBiologico}, nasc. ${perfil.dataNascimento}. Condições: ${perfil.condicoes.join(", ") || "nenhuma"}`;
      explicarLaudo(exame.textoOriginal, perfilStr)
        .then((res) => {
          setResultado(res);
          updateExame(exame.id, {
            resultado: res,
            resumo: res.resumo_geral,
            sistema: res.sistema,
          });
          // Show check-in after result loads
          setShowCheckin(true);
        })
        .catch(() => setError("Não foi possível analisar o laudo. Tente novamente."))
        .finally(() => setLoading(false));
    }
  }, [exame?.id]);

  const copyQuestions = () => {
    if (!resultado?.perguntas_para_medico) return;
    navigator.clipboard.writeText(resultado.perguntas_para_medico.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  // Group achados by status
  const groupedAchados = resultado?.achados
    ? {
        normal: resultado.achados.filter((a) => a.status === "normal"),
        atencao: resultado.achados.filter((a) => a.status === "atencao"),
        acompanhamento: resultado.achados.filter((a) => a.status === "acompanhamento"),
      }
    : null;

  return (
    <div className="px-5 pt-14 pb-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95 transition-transform">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 text-sm text-primary active:scale-95 transition-transform"
          aria-label="Compartilhar com médico"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Compartilhar com médico</span>
        </button>
      </div>

      {/* Header */}
      <div className="animate-reveal">
        <h1 className="text-2xl font-semibold">{exame.nome}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {resultado?.origem?.laboratorio || exame.laboratorio} · {formatDate(resultado?.origem?.data_coleta || exame.data)}
        </p>
        {(resultado?.sistema || exame.sistema) && (
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium bg-sage-light text-sage-muted">
            {resultado?.sistema || exame.sistema}
          </span>
        )}
      </div>

      {/* Tabs */}
      {hasEvolution && resultado && (
        <div className="mt-4 flex gap-1 bg-muted rounded-lg p-1 animate-reveal animate-reveal-delay-1">
          <button
            onClick={() => setActiveTab("explicacao")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "explicacao" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Explicação
          </button>
          <button
            onClick={() => setActiveTab("evolucao")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${activeTab === "evolucao" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Evolução
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-16 text-center animate-reveal">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground mt-4">{loadingMessages[loadingMsgIdx]}</p>
          <div className="mt-3 w-48 h-1 bg-muted rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-primary/40 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-8 bg-destructive/10 rounded-lg p-4 animate-reveal">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {resultado && activeTab === "explicacao" && (
        <div className="mt-6 space-y-6">
          {/* Alerta médico */}
          {resultado.alerta_medico && (
            <div className="bg-[hsl(var(--attention-bg))] rounded-lg p-4 border-l-4 border-[hsl(var(--attention))] animate-reveal">
              <p className="text-sm text-foreground font-medium">{resultado.alerta_medico}</p>
            </div>
          )}

          {/* Resumo geral */}
          <div className="bg-sage-light rounded-lg p-4 animate-reveal animate-reveal-delay-1">
            <p className="text-sm text-foreground leading-relaxed font-serif">{resultado.resumo_geral}</p>
          </div>

          {/* Achados agrupados */}
          {groupedAchados && (
            <div className="space-y-5 animate-reveal animate-reveal-delay-2">
              <h2 className="text-lg font-semibold">O que encontramos</h2>

              {groupedAchados.acompanhamento.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Acompanhamento recomendado
                  </p>
                  {groupedAchados.acompanhamento.map((a, i) => <FindingCard key={i} achado={a} />)}
                </div>
              )}

              {groupedAchados.atencao.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Merece atenção
                  </p>
                  {groupedAchados.atencao.map((a, i) => <FindingCard key={i} achado={a} />)}
                </div>
              )}

              {groupedAchados.normal.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CircleCheck className="w-3 h-3" /> Dentro do esperado
                  </p>
                  {groupedAchados.normal.map((a, i) => <FindingCard key={i} achado={a} />)}
                </div>
              )}
            </div>
          )}

          {/* Glossário */}
          {resultado.glossario?.length > 0 && (
            <div className="animate-reveal animate-reveal-delay-3">
              <GlossaryChips glossario={resultado.glossario} />
            </div>
          )}

          {/* Perguntas para médico */}
          {resultado.perguntas_para_medico?.length > 0 && (
            <div className="animate-reveal animate-reveal-delay-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-lg font-semibold">Perguntas para levar ao médico</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate("/consulta")}
                    className="flex items-center gap-1 text-xs text-primary active:scale-95 transition-transform"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    Preparo de consulta
                  </button>
                  <button
                    onClick={async () => {
                      const text = `Perguntas para minha próxima consulta:\n\n${resultado.perguntas_para_medico.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n— Laudo Amigável`;
                      if (navigator.share) {
                        await navigator.share({ title: 'Perguntas para o médico', text });
                      } else {
                        navigator.clipboard.writeText(text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-primary active:scale-95 transition-transform"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Compartilhar
                  </button>
                  <button
                    onClick={copyQuestions}
                    className="flex items-center gap-1 text-xs text-primary active:scale-95 transition-transform"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
              <div className="bg-card rounded-lg p-4 shadow-sm border border-border space-y-3">
                {resultado.perguntas_para_medico.map((q, i) => (
                  <div key={i} className="flex items-start gap-2">
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
              ⚕️ Este app não substitui consulta médica. Sempre discuta resultados com seu médico.
            </p>
          </div>
        </div>
      )}

      {/* Evolução tab content */}
      {resultado && activeTab === "evolucao" && (
        <EvolutionTabContent
          resultadoEvolutivo={resultadoEvolutivo}
          loading={evoLoading}
          exame={exame}
          previousExams={previousExams}
        />
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
              const perfilStr = `${perfil.nome}, ${perfil.sexoBiologico}, nasc. ${perfil.dataNascimento}`;
              explicarLaudo(exame.textoOriginal, perfilStr)
                .then((res) => { setResultado(res); updateExame(exame.id, { resultado: res, resumo: res.resumo_geral, sistema: res.sistema }); })
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

      {/* Check-in Sheet */}
      {showCheckin && (
        <CheckinSheet
          exameId={exame.id}
          onComplete={() => setShowCheckin(false)}
          onSkip={() => setShowCheckin(false)}
        />
      )}

      {/* Share with doctor */}
      <ShareWithDoctorSheet open={showShare} onOpenChange={setShowShare} />
    </div>
  );
}

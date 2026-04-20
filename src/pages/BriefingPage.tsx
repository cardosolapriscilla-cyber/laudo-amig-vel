import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, Activity, Stethoscope } from "lucide-react";

interface AchadoPrioritario {
  parametro: string;
  tendencia: "melhora" | "estavel" | "atencao" | "piora";
  ultima_data: string;
  ultimo_valor: string;
  nota: string;
}

interface CronologiaItem {
  data: string;
  exame: string;
  destaque: string;
}

interface BriefingJson {
  resumo_executivo: string;
  achados_prioritarios: AchadoPrioritario[];
  cronologia: CronologiaItem[];
  alertas?: string[];
  sugestoes_investigacao?: string[];
}

const tendenciaConfig = {
  melhora: { icon: TrendingUp, label: "Melhora", color: "text-primary", bg: "bg-sage-light" },
  estavel: { icon: Minus, label: "Estável", color: "text-muted-foreground", bg: "bg-muted" },
  atencao: { icon: AlertTriangle, label: "Atenção", color: "text-[hsl(var(--attention))]", bg: "bg-[hsl(var(--attention-bg))]" },
  piora: { icon: TrendingDown, label: "Piora", color: "text-[hsl(var(--follow-up))]", bg: "bg-[hsl(var(--follow-up-bg))]" },
};

function formatDate(d: string) {
  if (!d) return "";
  try {
    return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export default function BriefingPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<BriefingJson | null>(null);
  const [especialidade, setEspecialidade] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("shared_briefings")
          .select("briefing_json, especialidade, expires_at, created_at")
          .eq("token", token)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setError("Briefing não encontrado.");
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          setError("Este briefing expirou. Solicite um novo link ao paciente.");
          return;
        }

        setBriefing(data.briefing_json as unknown as BriefingJson);
        setEspecialidade(data.especialidade || "");
        setCreatedAt(data.created_at || "");

        // Register access (fire and forget)
        await supabase
          .from("shared_briefings")
          .update({ accessed_at: new Date().toISOString() })
          .eq("token", token);
      } catch (e: any) {
        console.error(e);
        setError("Não foi possível carregar o briefing.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground mt-4">Carregando briefing...</p>
        </div>
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--attention-bg))] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-[hsl(var(--attention))]" />
          </div>
          <h1 className="text-xl font-semibold">Briefing indisponível</h1>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Header */}
        <header className="border-b border-border pb-5 animate-reveal">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Briefing pré-consulta</span>
            {especialidade && <span>· {especialidade}</span>}
          </div>
          <h1 className="text-2xl font-serif font-semibold">Histórico de saúde do paciente</h1>
          {createdAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Gerado em {formatDate(createdAt.split("T")[0])}
            </p>
          )}
        </header>

        {/* Resumo executivo */}
        <section className="mt-6 bg-sage-light rounded-xl p-5 animate-reveal animate-reveal-delay-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Resumo executivo
          </p>
          <p className="text-base text-foreground leading-relaxed font-serif">
            {briefing.resumo_executivo}
          </p>
        </section>

        {/* Achados prioritários */}
        {briefing.achados_prioritarios?.length > 0 && (
          <section className="mt-8 animate-reveal animate-reveal-delay-2">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Achados prioritários
            </h2>
            <div className="space-y-3">
              {briefing.achados_prioritarios.map((a, i) => {
                const config = tendenciaConfig[a.tendencia] || tendenciaConfig.estavel;
                const Icon = config.icon;
                return (
                  <div key={i} className="bg-card rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{a.parametro}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {a.ultimo_valor} · {formatDate(a.ultima_data)}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex items-center gap-1 shrink-0 ${config.bg} ${config.color}`}>
                        <Icon className="w-3 h-3" /> {config.label}
                      </span>
                    </div>
                    {a.nota && (
                      <p className="text-sm text-foreground mt-2 leading-relaxed">{a.nota}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Cronologia */}
        {briefing.cronologia?.length > 0 && (
          <section className="mt-8 animate-reveal animate-reveal-delay-3">
            <h2 className="text-lg font-semibold mb-3">Cronologia</h2>
            <div className="relative pl-5 border-l-2 border-border space-y-4">
              {briefing.cronologia.map((c, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                  <p className="text-xs text-muted-foreground">{formatDate(c.data)}</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{c.exame}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{c.destaque}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Alertas */}
        {briefing.alertas && briefing.alertas.length > 0 && (
          <section className="mt-8 animate-reveal">
            <h2 className="text-lg font-semibold mb-3">Alertas</h2>
            <div className="space-y-2">
              {briefing.alertas.map((a, i) => (
                <div key={i} className="bg-[hsl(var(--attention-bg))] rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[hsl(var(--attention))] mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Sugestões */}
        {briefing.sugestoes_investigacao && briefing.sugestoes_investigacao.length > 0 && (
          <section className="mt-8 animate-reveal">
            <h2 className="text-lg font-semibold mb-3">Sugestões de investigação</h2>
            <div className="bg-card rounded-lg p-4 shadow-sm border border-border space-y-2">
              {briefing.sugestoes_investigacao.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-primary font-medium text-sm">·</span>
                  <p className="text-sm text-foreground leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Gerado pelo <span className="font-medium text-foreground">Nauta</span> — nauta.app.br
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed max-w-md mx-auto">
            Este briefing é um auxílio para a consulta e não substitui avaliação clínica direta.
          </p>
        </footer>
      </div>
    </div>
  );
}

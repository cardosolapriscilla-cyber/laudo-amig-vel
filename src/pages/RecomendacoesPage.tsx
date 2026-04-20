import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import { gerarRecomendacoesPreventivas } from "@/lib/claude";
import type { ResultadoRecomendacoes, RecomendacaoPreventiva } from "@/lib/claude";
import {
  ArrowLeft,
  Loader2,
  CalendarPlus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const PRIORIDADE_CONFIG = {
  alta:  { label: "Prioritário",  classe: "bg-[hsl(var(--follow-up-bg))] text-[hsl(var(--follow-up))]" },
  media: { label: "Recomendado",  classe: "bg-[hsl(var(--attention-bg))] text-[hsl(var(--attention))]" },
  baixa: { label: "Eletivo",      classe: "bg-muted text-muted-foreground" },
};

const ACAO_CONFIG = {
  agendar:          { icon: CalendarPlus,  label: "Agendar",       cor: "text-[hsl(var(--follow-up))]" },
  repetir_em_breve: { icon: Clock,         label: "Em breve",      cor: "text-[hsl(var(--attention))]" },
  em_dia:           { icon: CheckCircle2,  label: "Em dia",        cor: "text-primary" },
};

const loadingMessages = [
  "Analisando seu perfil de saúde...",
  "Consultando guidelines preventivos...",
  "Personalizando suas recomendações...",
];

// ─── CARD DE RECOMENDAÇÃO ─────────────────────────────────────────────────────

function RecomendacaoCard({
  rec,
  onAgendar,
}: {
  rec: RecomendacaoPreventiva;
  onAgendar: (rec: RecomendacaoPreventiva) => void;
}) {
  const [expanded, setExpanded] = useState(rec.prioridade === "alta" && rec.acao !== "em_dia");
  const prioridadeCfg = PRIORIDADE_CONFIG[rec.prioridade];
  const acaoCfg = ACAO_CONFIG[rec.acao];
  const AcaoIcon = acaoCfg.icon;
  const emDia = rec.acao === "em_dia";

  const formatDate = (d: string | null) => {
    if (!d) return null;
    try {
      return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className={`bg-card rounded-xl shadow-sm overflow-hidden transition-opacity ${emDia ? "opacity-70" : ""}`}>
      {/* Header do card */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 active:bg-muted/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${acaoCfg.cor}`}>
            <AcaoIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground">{rec.exame}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prioridadeCfg.classe}`}>
                {prioridadeCfg.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{rec.sistema}</p>
          </div>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          }
        </div>
      </button>

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-reveal">
          {/* Motivo personalizado */}
          <div className="bg-sage-light rounded-lg p-3">
            <p className="text-xs text-foreground leading-relaxed">{rec.motivo}</p>
          </div>

          {/* Metadados */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Frequência</p>
              <p className="text-xs font-medium text-foreground">{rec.frequencia_recomendada}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Último</p>
              <p className="text-xs font-medium text-foreground">
                {rec.ultimo_realizado ? formatDate(rec.ultimo_realizado) : "Não registrado"}
              </p>
            </div>
          </div>

          {/* Próxima data */}
          {rec.proximo_recomendado && !emDia && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Recomendado até: <strong className="text-foreground">{formatDate(rec.proximo_recomendado)}</strong></span>
            </div>
          )}

          {/* Fonte guideline */}
          <p className="text-[10px] text-muted-foreground">
            Baseado em: {rec.fonte_guideline}
          </p>

          {/* CTA */}
          {!emDia && (
            <button
              onClick={() => onAgendar(rec)}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground
                py-2.5 rounded-lg text-sm font-medium shadow-sm shadow-primary/15
                hover:shadow-md active:scale-[0.98] transition-all duration-200"
            >
              <CalendarPlus className="w-4 h-4" />
              Lembrar de agendar
            </button>
          )}

          {emDia && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">Você está em dia com este exame</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SEÇÃO POR PRIORIDADE ─────────────────────────────────────────────────────

function SecaoPrioridade({
  titulo,
  icone: Icone,
  recs,
  onAgendar,
}: {
  titulo: string;
  icone: React.ComponentType<{ className?: string }>;
  recs: RecomendacaoPreventiva[];
  onAgendar: (rec: RecomendacaoPreventiva) => void;
}) {
  if (recs.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icone className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{titulo}</p>
      </div>
      <div className="space-y-2">
        {recs.map((r) => (
          <RecomendacaoCard key={r.id} rec={r} onAgendar={onAgendar} />
        ))}
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function RecomendacoesPage() {
  const navigate = useNavigate();
  const { exames, perfil } = useExamStore();
  const { user } = useAuth();
  const [resultado, setResultado] = useState<ResultadoRecomendacoes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [agendando, setAgendando] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (resultado) return;
    setLoading(true);
    gerarRecomendacoesPreventivas(exames, perfil)
      .then(setResultado)
      .catch(() => setError("Não foi possível gerar as recomendações. Tente novamente."))
      .finally(() => setLoading(false));
  }, []);

  const handleAgendar = async (rec: RecomendacaoPreventiva) => {
    setAgendando(rec.id);
    try {
      if (user) {
        await supabase.from("lembretes_preventivos").upsert({
          auth_user_id: user.id,
          exame: rec.exame,
          sistema: rec.sistema,
          prioridade: rec.prioridade,
          data_recomendada: rec.proximo_recomendado,
          motivo: rec.motivo,
          fonte_guideline: rec.fonte_guideline,
          criado_em: new Date().toISOString(),
        }, { onConflict: "auth_user_id,exame" });
      }
      toast.success(`Lembrete criado para ${rec.exame}`);
    } catch {
      toast.error("Não foi possível salvar o lembrete.");
    } finally {
      setAgendando(null);
    }
  };

  const handleAtualizar = () => {
    setResultado(null);
    setError("");
    setLoading(true);
    gerarRecomendacoesPreventivas(exames, perfil)
      .then(setResultado)
      .catch(() => setError("Não foi possível gerar as recomendações."))
      .finally(() => setLoading(false));
  };

  // Agrupa por prioridade
  const recs = resultado?.recomendacoes ?? [];
  const alta  = recs.filter((r) => r.prioridade === "alta"  && r.acao !== "em_dia");
  const media = recs.filter((r) => r.prioridade === "media" && r.acao !== "em_dia");
  const baixa = recs.filter((r) => r.prioridade === "baixa" && r.acao !== "em_dia");
  const emDia = recs.filter((r) => r.acao === "em_dia");

  return (
    <div className="px-5 pt-14 pb-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        {resultado && (
          <button
            onClick={handleAtualizar}
            className="text-xs text-primary active:scale-95 transition-transform"
          >
            Atualizar
          </button>
        )}
      </div>

      <div className="animate-reveal">
        <h1 className="text-2xl font-semibold">Prevenção</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recomendações personalizadas para o seu perfil.
        </p>
      </div>

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
          <button onClick={handleAtualizar} className="mt-3 text-sm text-primary underline">
            Tentar novamente
          </button>
        </div>
      )}

      {resultado && (
        <div className="mt-6 space-y-6 animate-reveal">

          {/* Mensagem motivacional */}
          <div className="bg-sage-light rounded-lg p-4">
            <p className="text-sm text-foreground leading-relaxed font-serif">
              {resultado.mensagem_motivacional}
            </p>
            <p className="text-[10px] text-muted-foreground mt-2">
              Baseado em: {resultado.perfil_considerado}
            </p>
          </div>

          {/* Resumo rápido */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[hsl(var(--follow-up-bg))] rounded-lg p-3 text-center">
              <p className="text-xl font-serif font-semibold text-[hsl(var(--follow-up))]">{alta.length}</p>
              <p className="text-[10px] text-[hsl(var(--follow-up))] mt-0.5">prioritários</p>
            </div>
            <div className="bg-[hsl(var(--attention-bg))] rounded-lg p-3 text-center">
              <p className="text-xl font-serif font-semibold text-[hsl(var(--attention))]">{media.length}</p>
              <p className="text-[10px] text-[hsl(var(--attention))] mt-0.5">recomendados</p>
            </div>
            <div className="bg-[#E1F5EE] rounded-lg p-3 text-center">
              <p className="text-xl font-serif font-semibold text-[#0F6E56]">{emDia.length}</p>
              <p className="text-[10px] text-[#0F6E56] mt-0.5">em dia</p>
            </div>
          </div>

          {/* Seções */}
          <SecaoPrioridade
            titulo="Prioritários — agendar logo"
            icone={AlertTriangle}
            recs={alta}
            onAgendar={handleAgendar}
          />
          <SecaoPrioridade
            titulo="Recomendados"
            icone={Clock}
            recs={media}
            onAgendar={handleAgendar}
          />
          <SecaoPrioridade
            titulo="Eletivos"
            icone={CalendarPlus}
            recs={baixa}
            onAgendar={handleAgendar}
          />
          <SecaoPrioridade
            titulo="Em dia"
            icone={CheckCircle2}
            recs={emDia}
            onAgendar={handleAgendar}
          />

          {/* Próxima revisão */}
          {resultado.proxima_revisao && (
            <div className="bg-card rounded-lg p-4 shadow-sm border-l-4 border-primary">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Próxima revisão destas recomendações
              </p>
              <p className="text-sm text-foreground">
                {new Date(resultado.proxima_revisao + "T12:00:00").toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </p>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              ⚕️ Estas recomendações são orientativas e baseadas em guidelines populacionais.
              Sempre converse com seu médico antes de realizar ou modificar exames.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

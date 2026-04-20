import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import { gerarMapaSaude } from "@/lib/claude";
import type { MapaSaude, SistemaStatus } from "@/lib/claude";
import {
  ArrowLeft,
  Loader2,
  ChevronRight,
  Activity,
  Heart,
  FlaskConical,
  Droplets,
  Brain,
  Wind,
  Bone,
  Zap,
  Circle,
} from "lucide-react";

// ─── CONFIG DE SISTEMAS ────────────────────────────────────────────────────────

const SISTEMA_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  cor: string;
  corBg: string;
  corTexto: string;
}> = {
  Cardiovascular:    { icon: Heart,       cor: "#E24B4A", corBg: "#FCEBEB", corTexto: "#791F1F" },
  Metabólico:        { icon: FlaskConical, cor: "#BA7517", corBg: "#FAEEDA", corTexto: "#412402" },
  Hepatobiliar:      { icon: Activity,     cor: "#D85A30", corBg: "#FAECE7", corTexto: "#4A1B0C" },
  Renal:             { icon: Droplets,     cor: "#378ADD", corBg: "#E6F1FB", corTexto: "#042C53" },
  Endócrino:         { icon: Zap,          cor: "#7F77DD", corBg: "#EEEDFE", corTexto: "#26215C" },
  Hematológico:      { icon: Circle,       cor: "#D4537E", corBg: "#FBEAF0", corTexto: "#4B1528" },
  Respiratório:      { icon: Wind,         cor: "#1D9E75", corBg: "#E1F5EE", corTexto: "#04342C" },
  Musculoesquelético:{ icon: Bone,         cor: "#888780", corBg: "#F1EFE8", corTexto: "#2C2C2A" },
  Neurológico:       { icon: Brain,        cor: "#534AB7", corBg: "#EEEDFE", corTexto: "#26215C" },
  Outro:             { icon: Activity,     cor: "#888780", corBg: "#F1EFE8", corTexto: "#2C2C2A" },
};

const STATUS_CONFIG = {
  otimo:     { label: "Ótimo",      classe: "bg-[#E1F5EE] text-[#085041]" },
  bom:       { label: "Bom",        classe: "bg-[#EAF3DE] text-[#27500A]" },
  atencao:   { label: "Atenção",    classe: "bg-[hsl(var(--attention-bg))] text-[hsl(var(--attention))]" },
  alerta:    { label: "Alerta",     classe: "bg-[hsl(var(--follow-up-bg))] text-[hsl(var(--follow-up))]" },
  sem_dados: { label: "Sem dados",  classe: "bg-muted text-muted-foreground" },
};

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

function SistemaCard({
  sistema,
  onClick,
}: {
  sistema: SistemaStatus;
  onClick: () => void;
}) {
  const cfg = SISTEMA_CONFIG[sistema.sistema] ?? SISTEMA_CONFIG["Outro"];
  const statusCfg = STATUS_CONFIG[sistema.status];
  const Icon = cfg.icon;
  const semDados = sistema.status === "sem_dados";

  return (
    <button
      onClick={semDados ? undefined : onClick}
      className={`w-full flex items-center gap-4 p-4 bg-card rounded-xl shadow-sm text-left transition-all duration-200
        ${semDados
          ? "opacity-50 cursor-default"
          : "hover:shadow-md active:scale-[0.98]"
        }`}
    >
      {/* Ícone colorido */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: cfg.corBg }}
      >
        <Icon className="w-5 h-5" style={{ color: cfg.cor }} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{sistema.sistema}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.classe}`}>
            {statusCfg.label}
          </span>
        </div>

        {!semDados && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {sistema.narrativa}
          </p>
        )}

        {semDados && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Nenhum exame deste sistema ainda
          </p>
        )}

        {/* Indicadores de parâmetros */}
        {sistema.parametros_recentes.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {sistema.parametros_recentes.slice(0, 3).map((p, i) => (
              <span
                key={i}
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium
                  ${p.tendencia === "melhora" ? "bg-[#E1F5EE] text-[#0F6E56]"
                  : p.tendencia === "piora" || p.tendencia === "atencao" ? "bg-[hsl(var(--attention-bg))] text-[hsl(var(--attention))]"
                  : "bg-muted text-muted-foreground"}`}
              >
                {p.nome}
              </span>
            ))}
            {sistema.parametros_recentes.length > 3 && (
              <span className="text-[9px] text-muted-foreground">
                +{sistema.parametros_recentes.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {!semDados && (
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
    </button>
  );
}

function SistemaDetail({
  sistema,
  onClose,
}: {
  sistema: SistemaStatus;
  onClose: () => void;
}) {
  const cfg = SISTEMA_CONFIG[sistema.sistema] ?? SISTEMA_CONFIG["Outro"];
  const statusCfg = STATUS_CONFIG[sistema.status];
  const Icon = cfg.icon;
  const navigate = useNavigate();
  const { exames } = useExamStore();

  const examesDeste = exames.filter((e) => e.sistema === sistema.sistema);

  const tendenciaLabel = {
    melhora: "Melhora",
    estavel: "Estável",
    atencao: "Atenção",
    piora: "Piora",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto animate-reveal">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: cfg.corBg }}
          >
            <Icon className="w-6 h-6" style={{ color: cfg.cor }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{sistema.sistema}</h2>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.classe}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Narrativa */}
        <div className="bg-sage-light rounded-lg p-4 mb-4">
          <p className="text-sm text-foreground leading-relaxed font-serif">
            {sistema.narrativa}
          </p>
        </div>

        {/* Ação sugerida */}
        {sistema.acao_sugerida && (
          <div className="bg-card rounded-lg p-4 shadow-sm border-l-4 border-primary mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Próximo passo
            </p>
            <p className="text-sm text-foreground">{sistema.acao_sugerida}</p>
          </div>
        )}

        {/* Parâmetros */}
        {sistema.parametros_recentes.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Parâmetros monitorados
            </p>
            <div className="space-y-2">
              {sistema.parametros_recentes.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 shadow-sm">
                  <span className="text-sm text-foreground">{p.nome}</span>
                  <div className="flex items-center gap-2">
                    {p.ultimo_valor && (
                      <span className="text-xs text-muted-foreground">{p.ultimo_valor}</span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                      ${p.tendencia === "melhora" ? "bg-[#E1F5EE] text-[#0F6E56]"
                      : p.tendencia === "piora" || p.tendencia === "atencao" ? "bg-[hsl(var(--attention-bg))] text-[hsl(var(--attention))]"
                      : "bg-muted text-muted-foreground"}`}
                    >
                      {tendenciaLabel[p.tendencia as keyof typeof tendenciaLabel] ?? p.tendencia}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exames deste sistema */}
        {examesDeste.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Exames ({examesDeste.length})
            </p>
            <div className="space-y-2">
              {examesDeste.map((e) => (
                <button
                  key={e.id}
                  onClick={() => navigate(`/resultado/${e.id}`)}
                  className="w-full flex items-center justify-between bg-card rounded-lg px-3 py-2.5 shadow-sm
                    hover:shadow-md active:scale-[0.98] transition-all text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{e.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.data + "T12:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STATUS RING VISUAL (visão geral) ─────────────────────────────────────────

function StatusDonut({ sistemas }: { sistemas: SistemaStatus[] }) {
  const com_dados = sistemas.filter((s) => s.status !== "sem_dados");
  const otimos = com_dados.filter((s) => s.status === "otimo" || s.status === "bom").length;
  const total = com_dados.length;
  if (total === 0) return null;

  const pct = Math.round((otimos / total) * 100);
  const size = 96;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const color =
    pct >= 75 ? "hsl(var(--primary))" :
    pct >= 50 ? "hsl(var(--attention))" :
    "hsl(var(--follow-up))";

  return (
    <div className="flex items-center gap-4 bg-card rounded-xl p-4 shadow-sm">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-serif font-semibold" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          {otimos} de {total} sistemas em boa forma
        </p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {sistemas.filter((s) => s.status === "sem_dados").length > 0 && (
            `${sistemas.filter((s) => s.status === "sem_dados").length} sistemas ainda sem dados`
          )}
        </p>
        {/* Mini status dots */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {com_dados.map((s) => (
            <div
              key={s.sistema}
              className="w-2 h-2 rounded-full"
              style={{
                background:
                  s.status === "otimo" || s.status === "bom" ? "hsl(var(--primary))" :
                  s.status === "atencao" ? "hsl(var(--attention))" :
                  "hsl(var(--follow-up))",
              }}
              title={s.sistema}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

const loadingMessages = [
  "Lendo seus exames com cuidado...",
  "Agrupando por sistema fisiológico...",
  "Gerando sua visão de saúde...",
];

export default function MapaSaudePage() {
  const navigate = useNavigate();
  const { exames, perfil } = useExamStore();
  const [mapa, setMapa] = useState<MapaSaude | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [sistemaSelecionado, setSistemaSelecionado] = useState<SistemaStatus | null>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (exames.length === 0 || mapa) return;
    setLoading(true);
    const perfilStr = perfil;
    gerarMapaSaude(exames, perfilStr)
      .then(setMapa)
      .catch(() => setError("Não foi possível gerar o mapa. Tente novamente."))
      .finally(() => setLoading(false));
  }, []);

  const handleAtualizar = () => {
    setMapa(null);
    setError("");
    setLoading(true);
    gerarMapaSaude(exames, perfil)
      .then(setMapa)
      .catch(() => setError("Não foi possível gerar o mapa. Tente novamente."))
      .finally(() => setLoading(false));
  };

  // Ordena: alerta → atencao → bom → otimo → sem_dados
  const ordemStatus = { alerta: 0, atencao: 1, bom: 2, otimo: 3, sem_dados: 4 };
  const sistemasOrdenados = mapa
    ? [...mapa.sistemas].sort(
        (a, b) => (ordemStatus[a.status] ?? 5) - (ordemStatus[b.status] ?? 5)
      )
    : [];

  return (
    <div className="px-5 pt-14 pb-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        {mapa && (
          <button
            onClick={handleAtualizar}
            className="text-xs text-primary active:scale-95 transition-transform"
          >
            Atualizar
          </button>
        )}
      </div>

      <div className="animate-reveal">
        <h1 className="text-2xl font-semibold">Mapa de saúde</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão panorâmica dos seus sistemas fisiológicos.
        </p>
      </div>

      {exames.length === 0 && (
        <div className="mt-16 text-center animate-reveal">
          <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-medium">Ainda sem dados para mapear</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-[260px] mx-auto">
            Envie seus primeiros exames para ver o mapa de saúde por sistema.
          </p>
          <button
            onClick={() => navigate("/upload")}
            className="mt-6 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium text-sm
              shadow-md shadow-primary/15 hover:shadow-lg active:scale-[0.97] transition-all duration-200"
          >
            Enviar exame
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
          <button
            onClick={handleAtualizar}
            className="mt-3 text-sm text-primary underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {mapa && (
        <div className="mt-6 space-y-6 animate-reveal">
          {/* Donut de visão geral */}
          <StatusDonut sistemas={mapa.sistemas} />

          {/* Resumo geral */}
          <div className="bg-sage-light rounded-lg p-4">
            <p className="text-sm text-foreground leading-relaxed font-serif">
              {mapa.resumo_geral}
            </p>
          </div>

          {/* Lista de sistemas */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Sistemas fisiológicos
            </p>
            <div className="space-y-2">
              {sistemasOrdenados.map((s) => (
                <SistemaCard
                  key={s.sistema}
                  sistema={s}
                  onClick={() => setSistemaSelecionado(s)}
                />
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              ⚕️ O mapa de saúde é uma síntese baseada nos exames disponíveis. Não substitui avaliação médica.
            </p>
          </div>
        </div>
      )}

      {sistemaSelecionado && (
        <SistemaDetail
          sistema={sistemaSelecionado}
          onClose={() => setSistemaSelecionado(null)}
        />
      )}
    </div>
  );
}

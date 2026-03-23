import { useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import { ArrowLeft, FlaskConical, User, ChevronRight } from "lucide-react";
import type { PilarScore } from "@/types/health";

const statusColor: Record<string, string> = {
  otimo: "bg-primary",
  bom: "bg-primary/70",
  atencao: "bg-[hsl(var(--attention))]",
  incompleto: "bg-muted",
};

const statusLabel: Record<string, string> = {
  otimo: "Ótimo",
  bom: "Bom",
  atencao: "Atenção",
  incompleto: "Incompleto",
};

function scoreColor(score: number): string {
  if (score > 70) return "hsl(var(--primary))";
  if (score >= 50) return "hsl(var(--attention))";
  return "hsl(var(--follow-up))";
}

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-serif font-semibold" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground mt-1">Índice de Saúde</span>
      </div>
    </div>
  );
}

function PilarBar({ pilar }: { pilar: PilarScore }) {
  const Icon = pilar.fonte === "objetivo" ? FlaskConical : User;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm text-foreground">{pilar.nome}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{pilar.score}%</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-primary-foreground ${statusColor[pilar.status]}`}>
            {statusLabel[pilar.status]}
          </span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${statusColor[pilar.status]}`}
          style={{ width: `${pilar.score}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">{pilar.detalhe}</p>
    </div>
  );
}

export default function ScorePage() {
  const navigate = useNavigate();
  const { scores } = useExamStore();
  const latestScore = scores[0];

  if (!latestScore) {
    return (
      <div className="px-5 pt-14 pb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-6 active:scale-95 transition-transform">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="mt-16 text-center animate-reveal">
          <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-medium">Seu score será calculado</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-[260px] mx-auto">
            Envie um exame e responda ao check-in rápido para ver seu Índice de Saúde.
          </p>
        </div>
      </div>
    );
  }

  const { score_geral, frase_contexto, pilares, confiabilidade, comparacao_populacional, proximo_passo } = latestScore;

  return (
    <div className="px-5 pt-14 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-6 active:scale-95 transition-transform">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="flex flex-col items-center animate-reveal">
        <ScoreRing score={score_geral} size={180} />
        <p className="text-sm text-muted-foreground mt-3 text-center max-w-[280px]">{frase_contexto}</p>
      </div>

      {/* Pilares */}
      <div className="mt-8 space-y-5 animate-reveal animate-reveal-delay-1">
        <h2 className="text-lg font-semibold">Pilares</h2>
        {pilares.map((p) => (
          <PilarBar key={p.nome} pilar={p} />
        ))}
      </div>

      {/* Confiabilidade */}
      <div className="mt-6 bg-sage-light rounded-lg p-4 animate-reveal animate-reveal-delay-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Precisão: {confiabilidade.nivel}</p>
        <p className="text-sm text-foreground">{confiabilidade.mensagem}</p>
      </div>

      {/* Comparação populacional */}
      {comparacao_populacional && (
        <div className="mt-4 bg-card rounded-lg p-4 shadow-sm animate-reveal animate-reveal-delay-3">
          <p className="text-sm text-foreground">{comparacao_populacional}</p>
        </div>
      )}

      {/* Próximo passo */}
      <div className="mt-4 bg-card rounded-lg p-4 shadow-sm border-l-4 border-primary animate-reveal animate-reveal-delay-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Próximo passo</p>
        <p className="text-sm text-foreground">{proximo_passo}</p>
      </div>

      <div className="border-t pt-4 mt-6">
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          ⚕️ O Índice de Saúde é uma estimativa baseada nos dados disponíveis. Não substitui avaliação médica.
        </p>
      </div>
    </div>
  );
}

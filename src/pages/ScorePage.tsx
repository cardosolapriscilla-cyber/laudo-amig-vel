import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import { ArrowLeft, FlaskConical, User, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import type { PilarScore } from "@/types/health";
import CheckinSheet from "@/components/CheckinSheet";

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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" />
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

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function ScoreHistoryChart({ scores }: { scores: { data: string; score_geral: number }[] }) {
  const chartData = useMemo(
    () =>
      [...scores]
        .reverse()
        .map((s) => ({
          date: formatDateShort(s.data),
          score: s.score_geral,
        })),
    [scores]
  );

  if (chartData.length < 2) return null;

  return (
    <div className="mt-6 animate-reveal animate-reveal-delay-1">
      <h2 className="text-lg font-semibold mb-3">Evolução</h2>
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <ReferenceLine y={70} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.4} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value}`, "Score"]}
            />
            <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function YearlyReminder({ lastScoreDate }: { lastScoreDate: string }) {
  const daysSince = useMemo(() => {
    const last = new Date(lastScoreDate + "T00:00:00");
    const now = new Date();
    return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  }, [lastScoreDate]);

  if (daysSince < 330) return null; // show 1 month before 1 year

  const isOverdue = daysSince >= 365;

  return (
    <div className={`mt-4 rounded-lg p-4 flex items-start gap-3 animate-reveal animate-reveal-delay-2 ${
      isOverdue ? "bg-[hsl(var(--follow-up))/0.1] border border-[hsl(var(--follow-up))/0.3]" : "bg-[hsl(var(--attention))/0.1] border border-[hsl(var(--attention))/0.3]"
    }`}>
      <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${isOverdue ? "text-[hsl(var(--follow-up))]" : "text-[hsl(var(--attention))]"}`} />
      <div>
        <p className="text-sm font-medium text-foreground">
          {isOverdue ? "Seu Índice está desatualizado" : "Hora de atualizar seu Índice"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isOverdue
            ? `Faz mais de 1 ano desde sua última avaliação. Envie novos exames e refaça o check-in para manter seu acompanhamento em dia.`
            : `Sua última avaliação foi há ${daysSince} dias. Recomendamos atualizar ao menos 1× por ano para acompanhar sua evolução.`}
        </p>
      </div>
    </div>
  );
}

export default function ScorePage() {
  const navigate = useNavigate();
  const { scores, exames } = useExamStore();
  const [showCheckin, setShowCheckin] = useState(false);
  const latestScore = scores[0];
  const hasExames = exames.length > 0;
  const lastExameId = exames[0]?.id;

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
            {hasExames
              ? "Você já tem exames enviados! Responda ao check-in rápido para calcular seu Índice de Saúde."
              : "Envie um exame e responda ao check-in rápido para ver seu Índice de Saúde."}
          </p>
          {hasExames ? (
            <button
              onClick={() => setShowCheckin(true)}
              className="mt-6 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium text-sm
                shadow-md shadow-primary/15 hover:shadow-lg active:scale-[0.97] transition-all duration-200"
            >
              Responder check-in
            </button>
          ) : (
            <button
              onClick={() => navigate("/upload")}
              className="mt-6 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium text-sm
                shadow-md shadow-primary/15 hover:shadow-lg active:scale-[0.97] transition-all duration-200"
            >
              Enviar meu primeiro exame
            </button>
          )}
        </div>

        {showCheckin && lastExameId && (
          <CheckinSheet
            exameId={lastExameId}
            onComplete={() => setShowCheckin(false)}
            onSkip={() => setShowCheckin(false)}
          />
        )}
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

      {/* Yearly reminder */}
      {latestScore.data && <YearlyReminder lastScoreDate={latestScore.data} />}

      {/* Longitudinal chart */}
      <ScoreHistoryChart scores={scores.filter((s) => s.data)} />

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

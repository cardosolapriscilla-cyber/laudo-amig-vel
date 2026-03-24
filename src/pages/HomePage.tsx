import { useExamStore } from "@/stores/examStore";
import { ExamCard } from "@/components/ExamCard";
import { Plus, Leaf, FlaskConical, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function scoreColor(score: number): string {
  if (score > 70) return "hsl(var(--primary))";
  if (score >= 50) return "hsl(var(--attention))";
  return "hsl(var(--follow-up))";
}

function MiniScoreRing({ score }: { score: number }) {
  const size = 80;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-serif font-semibold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { exames, perfil, scores } = useExamStore();
  const navigate = useNavigate();

  // Redirect to onboarding if profile is default
  if (perfil.nome === "Ana" && perfil.dataNascimento === "1978-05-12") {
    navigate("/onboarding", { replace: true });
    return null;
  }

  const sortedExames = [...exames].sort((a, b) => b.data.localeCompare(a.data));
  const latest = sortedExames[0];
  const rest = sortedExames.slice(1);
  const latestScore = scores[0];

  return (
    <div className="px-5 pt-14 pb-6">
      {/* Header */}
      <div className="animate-reveal">
        <div className="flex items-center gap-2 mb-1">
          <Leaf className="w-5 h-5 text-primary" />
          <span className="text-xs font-medium text-primary tracking-wide uppercase">Laudo Amigável</span>
        </div>
        <h1 className="text-2xl font-semibold leading-tight mt-3">
          {getGreeting()}, {perfil.nome}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seu histórico de saúde em um só lugar.
        </p>
      </div>

      {/* Score Card */}
      {latestScore ? (
        <button
          onClick={() => navigate("/score")}
          className="w-full mt-6 bg-card rounded-xl p-5 shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 text-left animate-reveal animate-reveal-delay-1"
        >
          <div className="flex items-center gap-5">
            <MiniScoreRing score={latestScore.score_geral} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Índice de Saúde</p>
              <p className="text-sm text-foreground mt-1 leading-relaxed">{latestScore.frase_contexto}</p>
              <div className="mt-3 space-y-1.5">
                {latestScore.pilares.slice(0, 4).map((p) => (
                  <div key={p.nome} className="flex items-center gap-2">
                    {p.fonte === "objetivo" ? (
                      <FlaskConical className="w-3 h-3 text-muted-foreground shrink-0" />
                    ) : (
                      <User className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-[11px] text-muted-foreground w-24 truncate">{p.nome}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.score > 70 ? "bg-primary" : p.score >= 50 ? "bg-[hsl(var(--attention))]" : "bg-[hsl(var(--follow-up))]"}`}
                        style={{ width: `${p.score}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{p.score}%</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {latestScore.confiabilidade.pilares_preenchidos} de {latestScore.confiabilidade.total_pilares} pilares
              </p>
            </div>
          </div>
        </button>
      ) : (
        <button
          onClick={() => navigate('/upload')}
          className="w-full mt-6 bg-card rounded-xl p-5 shadow-sm border border-dashed border-border text-left animate-reveal animate-reveal-delay-1"
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Índice de Saúde</p>
          <p className="text-sm text-foreground mt-2">Envie seu primeiro exame e responda ao check-in para ver seu Índice de Saúde.</p>
          <p className="text-xs text-primary mt-3 font-medium">Enviar exame →</p>
        </button>
      )}

      {exames.length === 0 ? (
        <div className="mt-16 text-center animate-reveal animate-reveal-delay-1">
          <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
            <Leaf className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-medium">Seu histórico começa aqui</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-[260px] mx-auto">
            Envie seu primeiro exame e receba uma explicação clara e acolhedora.
          </p>
          <button
            onClick={() => navigate("/upload")}
            className="mt-6 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium text-sm
              shadow-md shadow-primary/15 hover:shadow-lg active:scale-[0.97] transition-all duration-200"
          >
            Enviar meu primeiro exame
          </button>
        </div>
      ) : (
        <>
          {latest && (
            <div className={`mt-6 animate-reveal ${latestScore ? "animate-reveal-delay-2" : "animate-reveal-delay-1"}`}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Último exame</p>
              <ExamCard exame={latest} featured />
            </div>
          )}

          {rest.length > 0 && (
            <div className={`mt-8 animate-reveal ${latestScore ? "animate-reveal-delay-3" : "animate-reveal-delay-2"}`}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Histórico</p>
              <div className="space-y-2">
                {rest.map((exame) => (
                  <ExamCard key={exame.id} exame={exame} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate("/upload")}
        className="fixed bottom-20 right-5 w-14 h-14 bg-primary text-primary-foreground rounded-2xl
          shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30
          flex items-center justify-center active:scale-95 transition-all duration-200 z-40"
        aria-label="Novo exame"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}

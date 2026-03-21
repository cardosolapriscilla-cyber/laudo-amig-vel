import { useExamStore } from "@/stores/examStore";
import { ExamCard } from "@/components/ExamCard";
import { Plus, Leaf } from "lucide-react";
import { useNavigate } from "react-router-dom";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function HomePage() {
  const { exames, perfil } = useExamStore();
  const navigate = useNavigate();
  const sortedExames = [...exames].sort((a, b) => b.data.localeCompare(a.data));
  const latest = sortedExames[0];
  const rest = sortedExames.slice(1);

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
          Seus exames, explicados com cuidado.
        </p>
      </div>

      {exames.length === 0 ? (
        /* Empty state */
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
          {/* Featured card */}
          {latest && (
            <div className="mt-6 animate-reveal animate-reveal-delay-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Último exame</p>
              <ExamCard exame={latest} featured />
            </div>
          )}

          {/* Timeline */}
          {rest.length > 0 && (
            <div className="mt-8 animate-reveal animate-reveal-delay-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Histórico</p>
              <div className="space-y-2">
                {rest.map((exame, i) => (
                  <div key={exame.id} className={`animate-reveal animate-reveal-delay-${Math.min(i + 2, 4)}`}>
                    <ExamCard exame={exame} />
                  </div>
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

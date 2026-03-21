import { useNavigate } from "react-router-dom";
import type { Exame } from "@/types/health";
import { ExamIcon } from "./ExamIcon";
import { ChevronRight } from "lucide-react";

const formatDate = (d: string) => {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

export function ExamCard({ exame, featured = false }: { exame: Exame; featured?: boolean }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/resultado/${exame.id}`)}
      className={`w-full text-left rounded-lg transition-[box-shadow,transform] duration-200 ease-out
        active:scale-[0.98] group
        ${featured
          ? "bg-primary p-5 shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/15"
          : "bg-card p-4 shadow-sm shadow-foreground/5 hover:shadow-md hover:shadow-foreground/8"
        }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-md p-2 ${featured ? "bg-primary-foreground/15" : "bg-sage-light"}`}>
          <ExamIcon tipo={exame.tipo} className={featured ? "text-primary-foreground" : "text-primary"} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${featured ? "text-primary-foreground" : "text-foreground"}`}>
            {exame.nome}
          </p>
          <p className={`text-xs mt-0.5 ${featured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {formatDate(exame.data)} · {exame.laboratorio}
          </p>
          {exame.resumo && (
            <p className={`text-xs mt-2 leading-relaxed ${featured ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {exame.resumo}
            </p>
          )}
        </div>
        <ChevronRight className={`w-4 h-4 mt-1 transition-transform duration-200 group-hover:translate-x-0.5 ${featured ? "text-primary-foreground/50" : "text-muted-foreground/50"}`} />
      </div>
    </button>
  );
}

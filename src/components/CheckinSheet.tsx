import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import { calcularScore } from "@/lib/claude";
import { Loader2 } from "lucide-react";

interface CheckinProps {
  exameId: string;
  onComplete: () => void;
  onSkip: () => void;
}

const questions = [
  {
    key: "sono_horas",
    label: "Sono",
    question: "Nas últimas 2 semanas, quantas horas você dormiu por noite em média?",
    options: ["< 5h", "5–6h", "6–7h", "7–8h", "> 8h"],
  },
  {
    key: "sono_qualidade",
    label: "Qualidade do sono",
    question: "Como você avalia a qualidade do seu sono nesse período?",
    options: ["Muito ruim", "Ruim", "Regular", "Boa", "Muito boa"],
  },
  {
    key: "estresse_pss",
    label: "Estresse",
    question: "Com que frequência você se sentiu incapaz de controlar as coisas importantes da sua vida?",
    options: ["Nunca", "Quase nunca", "Às vezes", "Com frequência", "Sempre"],
  },
  {
    key: "atividade_minutos",
    label: "Atividade física",
    question: "Quantos minutos por semana você praticou atividade física moderada?",
    options: ["Nenhum", "1–60 min", "60–150 min", "150–300 min", "> 300 min"],
  },
];

export default function CheckinSheet({ exameId, onComplete, onSkip }: CheckinProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [calculating, setCalculating] = useState(false);
  const [scoreError, setScoreError] = useState(false);

  const handleSelect = (value: string) => {
    const q = questions[step];
    const newAnswers = { ...answers, [q.key]: value };
    setAnswers(newAnswers);

    if (step < questions.length - 1) {
      setTimeout(() => setStep(step + 1), 200);
    }
  };

  const handleFinish = async () => {
    setCalculating(true);

    const checkin = {
      id: Date.now().toString(),
      data: new Date().toISOString().split("T")[0],
      exame_id: exameId,
      sono_horas: answers.sono_horas,
      sono_qualidade: answers.sono_qualidade,
      estresse_pss: answers.estresse_pss,
      atividade_minutos: answers.atividade_minutos,
    };
    addCheckin(checkin);

    try {
      const resumoExames = exames
        .slice(0, 5)
        .map((e) => `${e.nome} (${e.data}): ${e.resumo ?? "sem resumo"}`)
        .join("\n");

      const perfilStr = `${perfil.nome}, ${perfil.sexoBiologico}, nasc. ${perfil.dataNascimento}. Condições: ${perfil.condicoes.join(", ") || "nenhuma"}`;

      const score = await calcularScore({
        examesClinicosResumidos: resumoExames,
        checkin: answers,
        perfilUsuario: perfilStr,
      });
      addScore(score);
    } catch {
      setScoreError(true);
    }

    setCalculating(false);
    onComplete();
  };

  const isLastStep = step === questions.length - 1;
  const hasAnsweredCurrent = !!answers[questions[step]?.key];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-foreground/30" onClick={onSkip} />
      <div className="relative w-full max-w-md bg-background rounded-t-2xl p-5 pb-8 animate-reveal">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />

        <p className="text-xs text-muted-foreground mb-1">
          {step + 1} de {questions.length}
        </p>
        {/* Progress bar */}
        <div className="h-1 bg-muted rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / questions.length) * 100}%` }}
          />
        </div>

        <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
          {questions[step].label}
        </p>
        <h3 className="text-base font-medium text-foreground leading-snug mb-5">
          {questions[step].question}
        </h3>

        <div className="space-y-2">
          {questions[step].options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all duration-150 active:scale-[0.98]
                ${answers[questions[step].key] === opt
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-foreground border border-border hover:bg-muted"
                }`}
            >
              {opt}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {isLastStep && hasAnsweredCurrent && (
            <button
              onClick={handleFinish}
              disabled={calculating}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm
                shadow-md shadow-primary/15 disabled:opacity-60
                hover:shadow-lg active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2"
            >
              {calculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calculando seu score...
                </>
              ) : (
                "Ver meu exame"
              )}
            </button>
            {scoreError && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Não conseguimos calcular seu score agora. Você pode tentar novamente na aba Saúde.
              </p>
            )}
          )}
          <button
            onClick={onSkip}
            className="w-full text-center text-xs text-muted-foreground py-2 active:scale-95 transition-transform"
          >
            Pular por agora
          </button>
        </div>
      </div>
    </div>
  );
}

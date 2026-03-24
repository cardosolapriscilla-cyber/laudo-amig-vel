import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import { Leaf } from "lucide-react";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { setPerfil } = useExamStore();
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState<"feminino" | "masculino">("feminino");

  const canSubmit = nome.trim() && dataNascimento;

  const handleStart = () => {
    if (!canSubmit) return;
    setPerfil({ nome: nome.trim(), dataNascimento, sexoBiologico: sexo });
    navigate("/");
  };

  return (
    <div className="px-5 pt-20 pb-6 max-w-md mx-auto">
      <div className="text-center animate-reveal">
        <div className="w-14 h-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
          <Leaf className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Bem-vindo ao Laudo Amigável</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Vamos personalizar sua experiência com algumas informações básicas.
        </p>
      </div>

      <div className="mt-10 space-y-5 animate-reveal animate-reveal-delay-1">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Como podemos te chamar?
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            className="mt-2 w-full px-4 py-3 bg-card rounded-lg border border-border text-sm
              placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Data de nascimento
          </label>
          <input
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            className="mt-2 w-full px-4 py-3 bg-card rounded-lg border border-border text-sm
              text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Sexo biológico
          </label>
          <div className="mt-2 flex gap-2">
            {(["feminino", "masculino"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSexo(opt)}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98]
                  ${sexo === opt
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-foreground border border-border hover:bg-muted"
                  }`}
              >
                {opt === "feminino" ? "Feminino" : "Masculino"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleStart}
        disabled={!canSubmit}
        className="mt-10 w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm
          shadow-md shadow-primary/15 disabled:opacity-40 disabled:shadow-none
          hover:shadow-lg active:scale-[0.97] transition-all duration-200 animate-reveal animate-reveal-delay-2"
      >
        Começar
      </button>
    </div>
  );
}

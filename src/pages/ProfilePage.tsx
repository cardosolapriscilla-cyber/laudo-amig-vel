import { useExamStore } from "@/stores/examStore";
import { ArrowLeft, Leaf } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const CONDICOES = [
  "Diabetes", "Hipertensão", "Hipotireoidismo", "Dislipidemia",
  "Asma", "Ansiedade", "Depressão", "Outro",
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { perfil, setPerfil } = useExamStore();
  const [saved, setSaved] = useState(false);

  const toggleCondicao = (c: string) => {
    const next = perfil.condicoes.includes(c)
      ? perfil.condicoes.filter((x) => x !== c)
      : [...perfil.condicoes, c];
    setPerfil({ condicoes: next });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="px-5 pt-14 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-6 active:scale-95 transition-transform">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="flex items-center gap-3 animate-reveal">
        <div className="w-12 h-12 rounded-2xl bg-sage-light flex items-center justify-center">
          <Leaf className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Perfil de saúde</h1>
          <p className="text-xs text-muted-foreground">Usado apenas para personalizar suas explicações</p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {/* Name */}
        <div className="animate-reveal animate-reveal-delay-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</label>
          <input
            type="text"
            value={perfil.nome}
            onChange={(e) => setPerfil({ nome: e.target.value })}
            className="mt-1 w-full bg-card border border-border rounded-lg px-4 py-3 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Birth date */}
        <div className="animate-reveal animate-reveal-delay-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data de nascimento</label>
          <input
            type="date"
            value={perfil.dataNascimento}
            onChange={(e) => setPerfil({ dataNascimento: e.target.value })}
            className="mt-1 w-full bg-card border border-border rounded-lg px-4 py-3 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Biological sex */}
        <div className="animate-reveal animate-reveal-delay-3">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sexo biológico</label>
          <div className="mt-2 flex gap-2">
            {(["feminino", "masculino"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setPerfil({ sexoBiologico: s })}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.97]
                  ${perfil.sexoBiologico === s
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-foreground border border-border hover:bg-muted"
                  }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Conditions */}
        <div className="animate-reveal animate-reveal-delay-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Condições pré-existentes</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CONDICOES.map((c) => (
              <button
                key={c}
                onClick={() => toggleCondicao(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 active:scale-95
                  ${perfil.condicoes.includes(c)
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground border border-border hover:bg-muted"
                  }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Family history */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Histórico familiar</label>
          <textarea
            value={perfil.historicoFamiliar}
            onChange={(e) => setPerfil({ historicoFamiliar: e.target.value })}
            placeholder="Ex: Pai com diabetes tipo 2, mãe com hipertensão..."
            className="mt-1 w-full h-24 bg-card border border-border rounded-lg px-4 py-3 text-sm
              placeholder:text-muted-foreground/50 resize-none
              focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm
            shadow-md shadow-primary/15 hover:shadow-lg active:scale-[0.97] transition-all duration-200"
        >
          {saved ? "✓ Salvo" : "Salvar perfil"}
        </button>
      </div>
    </div>
  );
}

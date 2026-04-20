import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useExamStore } from "@/stores/examStore";
import {
  ArrowLeft,
  Copy,
  Check,
  Share2,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Calendar,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";

interface PerguntaItem {
  pergunta: string;
  exame: string;
  sistema: string;
  data: string;
  selecionada: boolean;
}

interface ConsultaForm {
  especialidade: string;
  data: string;
  local: string;
}

const ESPECIALIDADES = [
  "Clínico Geral",
  "Cardiologista",
  "Endocrinologista",
  "Hepatologista",
  "Nefrologista",
  "Ginecologista",
  "Urologista",
  "Gastroenterologista",
  "Pneumologista",
  "Reumatologista",
  "Outro",
];

function formatDate(d: string) {
  if (!d) return "";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return d;
  }
}

export default function ConsultaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { exames, perfil } = useExamStore();

  const todasPerguntas = useMemo<PerguntaItem[]>(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);

    const items: PerguntaItem[] = [];
    for (const exame of exames) {
      if (!exame.resultado?.perguntas_para_medico?.length) continue;
      const dataExame = new Date(exame.data + "T12:00:00");
      if (dataExame < cutoff) continue;

      for (const pergunta of exame.resultado.perguntas_para_medico) {
        items.push({
          pergunta,
          exame: exame.nome,
          sistema: exame.sistema ?? "Outro",
          data: exame.data,
          selecionada: true,
        });
      }
    }

    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.pergunta.slice(0, 60).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [exames]);

  const [perguntas, setPerguntas] = useState<PerguntaItem[]>(todasPerguntas);
  const [perguntaCustom, setPerguntaCustom] = useState("");
  const [mostrarFormConsulta, setMostrarFormConsulta] = useState(false);
  const [form, setForm] = useState<ConsultaForm>({ especialidade: "", data: "", local: "" });
  const [copiado, setCopiado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mostrarTodas, setMostrarTodas] = useState(false);

  const perguntasSelecionadas = perguntas.filter((p) => p.selecionada);
  const LIMITE_PREVIEW = 5;
  const perguntasVisiveis = mostrarTodas ? perguntas : perguntas.slice(0, LIMITE_PREVIEW);

  const togglePergunta = (idx: number) => {
    setPerguntas((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, selecionada: !p.selecionada } : p))
    );
  };

  const adicionarCustom = () => {
    if (!perguntaCustom.trim()) return;
    setPerguntas((prev) => [
      ...prev,
      {
        pergunta: perguntaCustom.trim(),
        exame: "Sua pergunta",
        sistema: "Outro",
        data: new Date().toISOString().split("T")[0],
        selecionada: true,
      },
    ]);
    setPerguntaCustom("");
  };

  const gerarTexto = () => {
    const lines = [
      `Perguntas para minha consulta${form.especialidade ? ` de ${form.especialidade}` : ""}`,
      form.data ? `Data: ${formatDate(form.data)}` : "",
      "",
      ...perguntasSelecionadas.map((p, i) => `${i + 1}. ${p.pergunta}`),
      "",
      "— Nauta | nauta.app.br",
    ]
      .filter((l) => l !== undefined)
      .join("\n");
    return lines;
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(gerarTexto());
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const compartilhar = async () => {
    const texto = gerarTexto();
    if (navigator.share) {
      await navigator.share({ title: "Perguntas para o médico", text: texto });
    } else {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado para a área de transferência");
    }
  };

  const salvarConsulta = async () => {
    if (!form.especialidade || !form.data || !user) return;
    setSalvando(true);
    try {
      await supabase.from("consultas_agendadas").insert({
        auth_user_id: user.id,
        especialidade: form.especialidade,
        data_consulta: new Date(form.data + "T00:00:00").toISOString(),
        local_consulta: form.local || null,
      });
      toast.success("Consulta salva! Você receberá um lembrete 24h antes.");
      setMostrarFormConsulta(false);
    } catch {
      toast.error("Não foi possível salvar a consulta.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="px-5 pt-14 pb-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground mb-6 active:scale-95 transition-transform"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="animate-reveal">
        <h1 className="text-2xl font-semibold">Preparo de consulta</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {perfil.nome ? `${perfil.nome} · ` : ""}
          {perguntasSelecionadas.length} pergunta{perguntasSelecionadas.length !== 1 ? "s" : ""} selecionada{perguntasSelecionadas.length !== 1 ? "s" : ""}
        </p>
      </div>

      {todasPerguntas.length === 0 && (
        <div className="mt-16 text-center animate-reveal">
          <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-medium">Nenhuma pergunta ainda</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-[260px] mx-auto">
            Envie exames para que a Nauta gere perguntas personalizadas para suas consultas.
          </p>
          <button
            onClick={() => navigate("/upload")}
            className="mt-6 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium text-sm
              shadow-md shadow-primary/15 active:scale-[0.97] transition-all duration-200"
          >
            Enviar exame
          </button>
        </div>
      )}

      {todasPerguntas.length > 0 && (
        <div className="mt-6 space-y-5 animate-reveal">

          <button
            onClick={() => setMostrarFormConsulta(!mostrarFormConsulta)}
            className="w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-sm text-left
              hover:shadow-md active:scale-[0.98] transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-sage-light flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Agendar consulta</p>
              <p className="text-xs text-muted-foreground">Salvar data e receber lembrete 24h antes</p>
            </div>
            {mostrarFormConsulta
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
            }
          </button>

          {mostrarFormConsulta && (
            <div className="bg-card rounded-xl p-4 space-y-3 animate-reveal">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Especialidade</label>
                <select
                  value={form.especialidade}
                  onChange={(e) => setForm((f) => ({ ...f, especialidade: e.target.value }))}
                  className="w-full mt-1 p-2.5 bg-background border border-border rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Selecione...</option>
                  {ESPECIALIDADES.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Data</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full mt-1 p-2.5 bg-background border border-border rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Local (opcional)</label>
                <input
                  type="text"
                  value={form.local}
                  onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
                  placeholder="Ex: Hospital Einstein, Dr. João Silva"
                  className="w-full mt-1 p-2.5 bg-background border border-border rounded-lg text-sm
                    placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <button
                onClick={salvarConsulta}
                disabled={!form.especialidade || !form.data || salvando}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium
                  shadow-sm disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {salvando ? "Salvando..." : "Salvar consulta"}
              </button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Perguntas ({perguntas.length})
              </p>
              <div className="flex gap-3">
                <button onClick={copiar} className="flex items-center gap-1 text-xs text-primary active:scale-95 transition-transform">
                  {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiado ? "Copiado" : "Copiar"}
                </button>
                <button onClick={compartilhar} className="flex items-center gap-1 text-xs text-primary active:scale-95 transition-transform">
                  <Share2 className="w-3.5 h-3.5" />
                  Enviar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {perguntasVisiveis.map((p, i) => (
                <button
                  key={i}
                  onClick={() => togglePergunta(i)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all active:scale-[0.98]
                    ${p.selecionada
                      ? "bg-card border-primary/30 shadow-sm"
                      : "bg-muted/30 border-transparent opacity-50"
                    }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors
                      ${p.selecionada ? "bg-primary border-primary" : "border-muted-foreground/30"}`}
                    >
                      {p.selecionada && (
                        <svg width="8" height="8" viewBox="0 0 8 8">
                          <path d="M1 4l2 2 4-4" stroke="hsl(var(--primary-foreground))" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground leading-relaxed">{p.pergunta}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {p.exame} · {formatDate(p.data)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {perguntas.length > LIMITE_PREVIEW && (
              <button
                onClick={() => setMostrarTodas(!mostrarTodas)}
                className="w-full mt-3 text-xs text-primary py-2 flex items-center justify-center gap-1 active:scale-95 transition-transform"
              >
                {mostrarTodas
                  ? <><ChevronUp className="w-3.5 h-3.5" /> Mostrar menos</>
                  : <><ChevronDown className="w-3.5 h-3.5" /> Ver mais {perguntas.length - LIMITE_PREVIEW} perguntas</>
                }
              </button>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Adicionar sua própria pergunta
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={perguntaCustom}
                onChange={(e) => setPerguntaCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionarCustom()}
                placeholder="Ex: Posso praticar exercício de alta intensidade?"
                className="flex-1 p-3 bg-card border border-border rounded-xl text-sm
                  placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={adicionarCustom}
                disabled={!perguntaCustom.trim()}
                className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center
                  disabled:opacity-40 active:scale-95 transition-all shrink-0 self-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {perguntasSelecionadas.length > 0 && (
            <button
              onClick={compartilhar}
              className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-medium text-sm
                shadow-md shadow-primary/15 hover:shadow-lg active:scale-[0.97] transition-all duration-200
                flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Compartilhar {perguntasSelecionadas.length} pergunta{perguntasSelecionadas.length !== 1 ? "s" : ""}
            </button>
          )}

          <div className="border-t pt-4">
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              ⚕️ Leve estas perguntas para sua próxima consulta — o médico terá mais contexto sobre seu histórico.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

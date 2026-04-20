import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Stethoscope,
  Trash2,
  ChevronRight,
  Bell,
  BellOff,
  Loader2,
  CalendarX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface Consulta {
  id: string;
  especialidade: string;
  data_consulta: string;
  local_consulta: string | null;
  lembrete_enviado: boolean | null;
  push_enviado: string | null;
  created_at: string | null;
}

interface ConsultaForm {
  especialidade: string;
  data: string;
  hora: string;
  local: string;
}

const FORM_VAZIO: ConsultaForm = {
  especialidade: "",
  data: "",
  hora: "",
  local: "",
};

const ESPECIALIDADES = [
  "Clínico Geral",
  "Cardiologista",
  "Endocrinologista",
  "Hepatologista",
  "Nefrologista",
  "Ginecologista / Obstetra",
  "Urologista",
  "Gastroenterologista",
  "Pneumologista",
  "Reumatologista",
  "Dermatologista",
  "Ortopedista",
  "Neurologista",
  "Psiquiatra",
  "Oftalmologista",
  "Otorrinolaringologista",
  "Nutricionista",
  "Outro",
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatDataConsulta(iso: string): { data: string; hora: string; relativa: string } {
  const d = new Date(iso);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
  const data = new Date(d); data.setHours(0, 0, 0, 0);

  const diffDias = Math.round((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  let relativa = "";
  if (diffDias === 0) relativa = "Hoje";
  else if (diffDias === 1) relativa = "Amanhã";
  else if (diffDias > 1 && diffDias <= 7) relativa = `Em ${diffDias} dias`;
  else if (diffDias < 0) relativa = `Há ${Math.abs(diffDias)} dia${Math.abs(diffDias) !== 1 ? "s" : ""}`;

  return {
    data: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
    hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    relativa,
  };
}

function isPassado(iso: string): boolean {
  return new Date(iso) < new Date();
}

// ─── COMPONENTE: CARD DE CONSULTA ─────────────────────────────────────────────

function ConsultaCard({
  consulta,
  onDelete,
  onPreparo,
}: {
  consulta: Consulta;
  onDelete: (id: string) => void;
  onPreparo: (especialidade: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data, hora, relativa } = formatDataConsulta(consulta.data_consulta);
  const passado = isPassado(consulta.data_consulta);
  const temLembrete = !!consulta.push_enviado || !!consulta.lembrete_enviado;

  const corRelativa =
    relativa === "Hoje" ? "text-[hsl(var(--follow-up))]" :
    relativa === "Amanhã" ? "text-[hsl(var(--attention))]" :
    passado ? "text-muted-foreground" :
    "text-primary";

  return (
    <div className={`bg-card rounded-xl shadow-sm overflow-hidden transition-opacity ${passado ? "opacity-60" : ""}`}>
      {/* Faixa lateral colorida */}
      <div className="flex">
        <div className={`w-1 shrink-0 ${passado ? "bg-muted" : relativa === "Hoje" ? "bg-[hsl(var(--follow-up))]" : relativa === "Amanhã" ? "bg-[hsl(var(--attention))]" : "bg-primary"}`} />

        <div className="flex-1 p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{consulta.especialidade}</p>
              {relativa && (
                <span className={`text-[10px] font-medium ${corRelativa}`}>{relativa}</span>
              )}
            </div>

            {/* Indicadores */}
            <div className="flex items-center gap-2 shrink-0">
              {temLembrete ? (
                <Bell className="w-3.5 h-3.5 text-primary" />
              ) : (
                <BellOff className="w-3.5 h-3.5 text-muted-foreground/40" />
              )}
              {passado ? null : (
                <button
                  onClick={() => setConfirmDelete(!confirmDelete)}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Detalhes */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{data}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{hora}</span>
            </div>
            {consulta.local_consulta && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{consulta.local_consulta}</span>
              </div>
            )}
          </div>

          {/* Ações */}
          {!passado && (
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
              <button
                onClick={() => onPreparo(consulta.especialidade)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                  bg-sage-light text-primary text-xs font-medium
                  hover:bg-sage-light/80 active:scale-[0.98] transition-all"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Preparar consulta
              </button>
            </div>
          )}

          {/* Confirmação de delete */}
          {confirmDelete && (
            <div className="mt-3 pt-3 border-t border-border/50 animate-reveal">
              <p className="text-xs text-muted-foreground mb-2">Remover esta consulta?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onDelete(consulta.id); setConfirmDelete(false); }}
                  className="flex-1 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium active:scale-95 transition-all"
                >
                  Remover
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium active:scale-95 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE: FORM DE NOVA CONSULTA ────────────────────────────────────────

function NovaConsultaSheet({
  onSave,
  onClose,
}: {
  onSave: (form: ConsultaForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ConsultaForm>(FORM_VAZIO);
  const [saving, setSaving] = useState(false);

  const canSave = form.especialidade && form.data;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const hojeISO = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-2xl p-5 pb-8 animate-reveal">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <h2 className="text-lg font-semibold mb-5">Nova consulta</h2>

        <div className="space-y-4">
          {/* Especialidade */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Especialidade *
            </label>
            <select
              value={form.especialidade}
              onChange={(e) => setForm((f) => ({ ...f, especialidade: e.target.value }))}
              className="w-full mt-1.5 p-3 bg-card border border-border rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
            >
              <option value="">Selecione...</option>
              {ESPECIALIDADES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Data *
            </label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              min={hojeISO}
              className="w-full mt-1.5 p-3 bg-card border border-border rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Hora */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Horário <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="time"
              value={form.hora}
              onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
              className="w-full mt-1.5 p-3 bg-card border border-border rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Local */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Local / médico <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={form.local}
              onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
              placeholder="Ex: Hospital Einstein, Dra. Ana Lima"
              className="w-full mt-1.5 p-3 bg-card border border-border rounded-xl text-sm
                placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium text-sm
              shadow-md shadow-primary/15 disabled:opacity-40
              active:scale-[0.98] transition-all duration-200
              flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            ) : (
              "Salvar consulta"
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm text-muted-foreground active:scale-95 transition-transform"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function ConsultasAgendaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"proximas" | "passadas">("proximas");

  // ── Carregar ───────────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("consultas_agendadas")
        .select("*")
        .eq("auth_user_id", user.id)
        .order("data_consulta", { ascending: true });

      if (error) throw error;
      setConsultas(data ?? []);
    } catch (err: any) {
      toast.error("Não foi possível carregar as consultas.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Criar ──────────────────────────────────────────────────────────────────
  const handleCreate = async (form: ConsultaForm) => {
    if (!user) return;

    // Combina data + hora em ISO
    const dataHora = form.hora
      ? `${form.data}T${form.hora}:00`
      : `${form.data}T09:00:00`;

    const { error } = await supabase.from("consultas_agendadas").insert({
      auth_user_id: user.id,
      especialidade: form.especialidade,
      data_consulta: new Date(dataHora).toISOString(),
      local_consulta: form.local || null,
    });

    if (error) {
      toast.error("Não foi possível salvar a consulta.");
      throw error;
    }

    toast.success("Consulta agendada! Lembrete enviado 24h antes.");
    await carregar();
  };

  // ── Deletar ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("consultas_agendadas")
      .delete()
      .eq("id", id)
      .eq("auth_user_id", user?.id ?? "");

    if (error) {
      toast.error("Não foi possível remover a consulta.");
      return;
    }
    setConsultas((prev) => prev.filter((c) => c.id !== id));
    toast.success("Consulta removida.");
  };

  // ── Preparo ────────────────────────────────────────────────────────────────
  const handlePreparo = (especialidade: string) => {
    navigate("/consulta", { state: { especialidade } });
  };

  // ── Filtros ────────────────────────────────────────────────────────────────
  const agora = new Date();
  const proximas = consultas.filter((c) => new Date(c.data_consulta) >= agora);
  const passadas = consultas.filter((c) => new Date(c.data_consulta) < agora)
    .reverse(); // mais recente primeiro
  const lista = abaAtiva === "proximas" ? proximas : passadas;

  // ── Próxima consulta (destaque) ────────────────────────────────────────────
  const proxima = proximas[0];

  return (
    <div className="px-5 pt-14 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button
          onClick={() => setMostrarForm(true)}
          className="flex items-center gap-1.5 text-sm text-primary font-medium active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" /> Nova consulta
        </button>
      </div>

      <div className="animate-reveal">
        <h1 className="text-2xl font-semibold">Consultas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {proximas.length > 0
            ? `${proximas.length} próxima${proximas.length !== 1 ? "s" : ""}`
            : "Nenhuma consulta agendada"}
        </p>
      </div>

      {/* Card destaque — próxima consulta */}
      {proxima && (
        <div className="mt-5 animate-reveal animate-reveal-delay-1">
          {(() => {
            const { data, hora, relativa } = formatDataConsulta(proxima.data_consulta);
            const isHoje = relativa === "Hoje";
            const isAmanha = relativa === "Amanhã";
            return (
              <div className={`rounded-2xl p-5 ${isHoje ? "bg-[hsl(var(--follow-up-bg))]" : isAmanha ? "bg-[hsl(var(--attention-bg))]" : "bg-sage-light"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-[10px] font-medium uppercase tracking-wider mb-1 ${isHoje ? "text-[hsl(var(--follow-up))]" : isAmanha ? "text-[hsl(var(--attention))]" : "text-primary"}`}>
                      {relativa || "Próxima consulta"}
                    </p>
                    <p className="text-lg font-semibold text-foreground">{proxima.especialidade}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" /> {data}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" /> {hora}
                      </span>
                    </div>
                    {proxima.local_consulta && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="w-3.5 h-3.5" /> {proxima.local_consulta}
                      </span>
                    )}
                  </div>
                  <Stethoscope className={`w-8 h-8 ${isHoje ? "text-[hsl(var(--follow-up))]" : isAmanha ? "text-[hsl(var(--attention))]" : "text-primary"} opacity-40`} />
                </div>

                <button
                  onClick={() => handlePreparo(proxima.especialidade)}
                  className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
                    ${isHoje ? "bg-[hsl(var(--follow-up))] text-white" : isAmanha ? "bg-[hsl(var(--attention))] text-white" : "bg-primary text-primary-foreground"}
                    active:scale-[0.98] transition-all shadow-sm`}
                >
                  <Stethoscope className="w-4 h-4" />
                  Preparar perguntas
                  <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-16 text-center">
          <Loader2 className="w-6 h-6 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground mt-3">Carregando consultas...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && consultas.length === 0 && (
        <div className="mt-16 text-center animate-reveal">
          <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
            <CalendarX className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-medium">Nenhuma consulta</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-[240px] mx-auto">
            Agende suas consultas para receber lembretes e preparar suas perguntas.
          </p>
          <button
            onClick={() => setMostrarForm(true)}
            className="mt-6 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium text-sm
              shadow-md shadow-primary/15 active:scale-[0.97] transition-all"
          >
            Agendar consulta
          </button>
        </div>
      )}

      {/* Abas proximas / passadas */}
      {!loading && consultas.length > 0 && (
        <div className="mt-6 animate-reveal animate-reveal-delay-2">
          <div className="flex gap-1 bg-muted rounded-lg p-1 mb-4">
            <button
              onClick={() => setAbaAtiva("proximas")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all
                ${abaAtiva === "proximas" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Próximas {proximas.length > 0 && `(${proximas.length})`}
            </button>
            <button
              onClick={() => setAbaAtiva("passadas")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all
                ${abaAtiva === "passadas" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Histórico {passadas.length > 0 && `(${passadas.length})`}
            </button>
          </div>

          {lista.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {abaAtiva === "proximas" ? "Nenhuma consulta futura." : "Nenhuma consulta passada."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {lista.map((c) => (
                <ConsultaCard
                  key={c.id}
                  consulta={c}
                  onDelete={handleDelete}
                  onPreparo={handlePreparo}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form sheet */}
      {mostrarForm && (
        <NovaConsultaSheet
          onSave={handleCreate}
          onClose={() => setMostrarForm(false)}
        />
      )}
    </div>
  );
}

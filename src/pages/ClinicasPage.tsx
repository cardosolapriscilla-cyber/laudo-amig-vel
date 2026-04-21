import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Phone, MessageCircle, Trash2,
  Building2, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, Send, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useExamStore } from "@/stores/examStore";
import { toast } from "sonner";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface Clinica {
  id: string;
  nome: string;
  tipo: "clinica" | "laboratorio" | "medico";
  telefone: string | null;
  whatsapp: string | null;
  especialidade: string | null;
  whatsapp_valido: boolean | null;
  verificado_em: string | null;
  sistemas: string[];
}

interface TemplateDisparo {
  clinica: Clinica;
  motivo: string;        // ex: "1 ano desde último hemograma"
  exame: string;
  tipo: "agendar_exame" | "agendar_consulta";
}

// ─── TEMPLATES DE MENSAGEM ────────────────────────────────────────────────────

function gerarMensagem(template: TemplateDisparo, nomeUsuario: string): string {
  const saudacao = `Olá, tudo bem?`;
  const nome = nomeUsuario ? ` Me chamo ${nomeUsuario}.` : "";

  if (template.tipo === "agendar_exame") {
    return [
      `${saudacao}${nome}`,
      ``,
      `Gostaria de agendar um *${template.exame}*.`,
      ``,
      `Vocês têm disponibilidade? Quais são os horários e o valor do exame?`,
      ``,
      `Obrigado(a)!`,
    ].join("\n");
  }

  return [
    `${saudacao}${nome}`,
    ``,
    `Gostaria de agendar uma consulta com *${template.clinica.especialidade || "o médico"}*.`,
    ``,
    `Têm disponibilidade? Quais são os horários?`,
    ``,
    `Obrigado(a)!`,
  ].join("\n");
}

function urlWhatsApp(numero: string, mensagem: string): string {
  const clean = numero.replace(/\D/g, "");
  const encoded = encodeURIComponent(mensagem);
  return `https://wa.me/55${clean}?text=${encoded}`;
}

// ─── COMPONENTE: MODAL DE DISPARO ─────────────────────────────────────────────

function DisparoModal({
  template,
  nomeUsuario,
  onClose,
}: {
  template: TemplateDisparo;
  nomeUsuario: string;
  onClose: () => void;
}) {
  const [mensagem, setMensagem] = useState(gerarMensagem(template, nomeUsuario));
  const hasWhatsApp = !!template.clinica.whatsapp;

  const handleEnviar = () => {
    if (!hasWhatsApp) return;
    const url = urlWhatsApp(template.clinica.whatsapp!, mensagem);
    window.open(url, "_blank");
    onClose();
  };

  const handleCopiar = async () => {
    await navigator.clipboard.writeText(mensagem);
    toast.success("Mensagem copiada!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-2xl p-5 pb-8 animate-reveal max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Enviar mensagem</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {template.clinica.nome} · {template.motivo}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editor de mensagem */}
        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Mensagem
          </label>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={8}
            className="w-full p-3 bg-card border border-border rounded-xl text-sm
              leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Edite livremente antes de enviar.
          </p>
        </div>

        {/* Contato */}
        <div className="bg-muted/50 rounded-xl p-3 mb-4 flex items-center gap-3">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{template.clinica.nome}</p>
            <p className="text-xs text-muted-foreground">
              {hasWhatsApp ? template.clinica.whatsapp : template.clinica.telefone}
            </p>
          </div>
          {hasWhatsApp && (
            <span className="text-[10px] bg-[#E1F5EE] text-[#085041] px-2 py-0.5 rounded-full font-medium">
              WhatsApp
            </span>
          )}
        </div>

        <div className="space-y-2">
          {hasWhatsApp ? (
            <button
              onClick={handleEnviar}
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white
                py-3 rounded-xl font-medium text-sm shadow-sm active:scale-[0.98] transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Abrir no WhatsApp
            </button>
          ) : null}

          <button
            onClick={handleCopiar}
            className="w-full flex items-center justify-center gap-2 bg-card border border-border
              py-3 rounded-xl text-sm font-medium active:scale-[0.98] transition-all"
          >
            <Send className="w-4 h-4" />
            {hasWhatsApp ? "Copiar mensagem" : "Copiar (sem WhatsApp cadastrado)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE: FORM DE NOVA CLÍNICA ─────────────────────────────────────────

function NovaClinicaSheet({
  onSave,
  onClose,
}: {
  onSave: (data: Omit<Clinica, "id" | "whatsapp_valido" | "verificado_em">) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    nome: "",
    tipo: "laboratorio" as Clinica["tipo"],
    telefone: "",
    whatsapp: "",
    especialidade: "",
    sistemas: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const SISTEMAS = [
    "Cardiovascular", "Metabólico", "Hepatobiliar", "Renal",
    "Endócrino", "Hematológico", "Respiratório", "Musculoesquelético",
  ];

  const toggleSistema = (s: string) => {
    setForm((f) => ({
      ...f,
      sistemas: f.sistemas.includes(s)
        ? f.sistemas.filter((x) => x !== s)
        : [...f.sistemas, s],
    }));
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto animate-reveal">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-semibold mb-5">Adicionar contato de saúde</h2>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</label>
            <div className="mt-1.5 flex gap-2">
              {(["laboratorio", "clinica", "medico"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95
                    ${form.tipo === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
                >
                  {t === "laboratorio" ? "Laboratório" : t === "clinica" ? "Clínica" : "Médico"}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Nome *
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder={form.tipo === "medico" ? "Dr. João Silva" : "Laboratório Fleury"}
              className="w-full mt-1.5 p-3 bg-card border border-border rounded-xl text-sm
                placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* WhatsApp */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              WhatsApp
              <span className="ml-1 text-[10px] text-primary font-normal normal-case">recomendado</span>
            </label>
            <div className="mt-1.5 relative">
              <MessageCircle className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="w-full pl-10 pr-4 p-3 bg-card border border-border rounded-xl text-sm
                  placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Telefone fixo <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
            </label>
            <div className="mt-1.5 relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                placeholder="(11) 3333-3333"
                className="w-full pl-10 pr-4 p-3 bg-card border border-border rounded-xl text-sm
                  placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Especialidade (só para médico) */}
          {form.tipo === "medico" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Especialidade</label>
              <input
                type="text"
                value={form.especialidade}
                onChange={(e) => setForm((f) => ({ ...f, especialidade: e.target.value }))}
                placeholder="Ex: Cardiologista"
                className="w-full mt-1.5 p-3 bg-card border border-border rounded-xl text-sm
                  placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {/* Sistemas cobertos */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sistemas / exames cobertos <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
            </label>
            <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">
              Usado para sugerir este contato quando for a hora de agendar.
            </p>
            <div className="flex flex-wrap gap-2">
              {SISTEMAS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSistema(s)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all active:scale-95
                    ${form.sistemas.includes(s) ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <button
            onClick={handleSave}
            disabled={!form.nome.trim() || saving}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium text-sm
              shadow-md shadow-primary/15 disabled:opacity-40 active:scale-[0.98] transition-all
              flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : "Salvar contato"}
          </button>
          <button onClick={onClose} className="w-full py-2.5 text-sm text-muted-foreground active:scale-95 transition-transform">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CARD DE CLÍNICA ──────────────────────────────────────────────────────────

function ClinicaCard({
  clinica,
  onDelete,
  onDisparo,
}: {
  clinica: Clinica;
  onDelete: (id: string) => void;
  onDisparo: (clinica: Clinica) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasWhatsApp = !!clinica.whatsapp;
  const tipoLabel = { clinica: "Clínica", laboratorio: "Laboratório", medico: "Médico" };

  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Ícone */}
          <div className="w-10 h-10 rounded-xl bg-sage-light flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">{clinica.nome}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {tipoLabel[clinica.tipo]}
                  {clinica.especialidade ? ` · ${clinica.especialidade}` : ""}
                </p>
              </div>
              <button
                onClick={() => setConfirmDelete(!confirmDelete)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Contatos */}
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {hasWhatsApp && (
                <span className="flex items-center gap-1 text-[11px]">
                  <MessageCircle className="w-3 h-3 text-[#25D366]" />
                  <span className="text-foreground">{clinica.whatsapp}</span>
                  {clinica.whatsapp_valido === true && (
                    <CheckCircle2 className="w-3 h-3 text-primary" />
                  )}
                  {clinica.whatsapp_valido === false && (
                    <AlertCircle className="w-3 h-3 text-[hsl(var(--follow-up))]" />
                  )}
                </span>
              )}
              {clinica.telefone && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {clinica.telefone}
                </span>
              )}
            </div>

            {/* Sistemas */}
            {clinica.sistemas?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {clinica.sistemas.map((s) => (
                  <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-sage-light text-primary font-medium">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <button
            onClick={() => onDisparo(clinica)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
              bg-sage-light text-primary text-sm font-medium
              hover:bg-sage-light/80 active:scale-[0.98] transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            Preparar mensagem
            <ChevronRight className="w-3.5 h-3.5 ml-auto" />
          </button>
        </div>

        {/* Confirm delete */}
        {confirmDelete && (
          <div className="mt-3 pt-3 border-t border-border/50 animate-reveal">
            <p className="text-xs text-muted-foreground mb-2">Remover este contato?</p>
            <div className="flex gap-2">
              <button onClick={() => { onDelete(clinica.id); setConfirmDelete(false); }}
                className="flex-1 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium active:scale-95">
                Remover
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium active:scale-95">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function ClinicasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { perfil, exames } = useExamStore();
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [templateAtivo, setTemplateAtivo] = useState<TemplateDisparo | null>(null);

  // ── Carregar ─────────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("clinicas_usuario")
      .select("*")
      .eq("auth_user_id", user.id)
      .order("nome");
    setClinicas((data ?? []) as Clinica[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Criar ────────────────────────────────────────────────────────────────
  const handleCreate = async (form: Omit<Clinica, "id" | "whatsapp_valido" | "verificado_em">) => {
    if (!user) return;
    const { error } = await supabase.from("clinicas_usuario").insert({
      auth_user_id: user.id,
      ...form,
    });
    if (error) { toast.error("Não foi possível salvar."); throw error; }
    toast.success("Contato adicionado!");
    await carregar();
  };

  // ── Deletar ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await supabase.from("clinicas_usuario").delete().eq("id", id).eq("auth_user_id", user?.id ?? "");
    setClinicas((prev) => prev.filter((c) => c.id !== id));
    toast.success("Contato removido.");
  };

  // ── Abrir disparo ────────────────────────────────────────────────────────
  const handleDisparo = (clinica: Clinica) => {
    // Tenta encontrar um exame relacionado para sugerir contexto
    const ultimoExame = exames
      .filter((e) => clinica.sistemas?.includes(e.sistema ?? ""))
      .sort((a, b) => b.data.localeCompare(a.data))[0];

    setTemplateAtivo({
      clinica,
      motivo: ultimoExame
        ? `Último ${ultimoExame.nome}: ${ultimoExame.data}`
        : "Agendamento",
      exame: ultimoExame?.nome ?? "exame de rotina",
      tipo: clinica.tipo === "medico" ? "agendar_consulta" : "agendar_exame",
    });
  };

  return (
    <div className="px-5 pt-14 pb-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95 transition-transform">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button onClick={() => setMostrarForm(true)}
          className="flex items-center gap-1.5 text-sm text-primary font-medium active:scale-95 transition-transform">
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      <div className="animate-reveal">
        <h1 className="text-2xl font-semibold">Meus contatos de saúde</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Clínicas, laboratórios e médicos para agendar com um toque.
        </p>
      </div>

      {loading && (
        <div className="mt-16 text-center">
          <Loader2 className="w-6 h-6 text-primary mx-auto animate-spin" />
        </div>
      )}

      {!loading && clinicas.length === 0 && (
        <div className="mt-16 text-center animate-reveal">
          <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-medium">Nenhum contato ainda</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-[260px] mx-auto">
            Adicione suas clínicas e médicos para enviar mensagens de agendamento com um toque, na hora certa.
          </p>
          <button onClick={() => setMostrarForm(true)}
            className="mt-6 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium text-sm
              shadow-md shadow-primary/15 active:scale-[0.97] transition-all">
            Adicionar contato
          </button>
        </div>
      )}

      {!loading && clinicas.length > 0 && (
        <div className="mt-6 space-y-3 animate-reveal">
          {clinicas.map((c) => (
            <ClinicaCard key={c.id} clinica={c} onDelete={handleDelete} onDisparo={handleDisparo} />
          ))}
        </div>
      )}

      {mostrarForm && <NovaClinicaSheet onSave={handleCreate} onClose={() => setMostrarForm(false)} />}
      {templateAtivo && (
        <DisparoModal
          template={templateAtivo}
          nomeUsuario={perfil.nome}
          onClose={() => setTemplateAtivo(null)}
        />
      )}
    </div>
  );
}

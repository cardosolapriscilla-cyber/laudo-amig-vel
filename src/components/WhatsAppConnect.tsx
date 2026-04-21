import { useState, useEffect } from "react";
import { MessageCircle, Check, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useExamStore } from "@/stores/examStore";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "@/hooks/use-toast";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function rawPhone(formatted: string) {
  return formatted.replace(/\D/g, "");
}

export default function WhatsAppConnect() {
  const { perfil, exames } = useExamStore();
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectedPhone, setConnectedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  // Carrega o telefone do WhatsApp do perfil do usuário logado
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("perfis")
        .select("whatsapp_phone")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (data?.whatsapp_phone) {
        setConnected(true);
        setConnectedPhone(data.whatsapp_phone);
      }
    })();
  }, [user]);

  const handleConnect = async () => {
    if (!user) {
      toast({ title: "Faça login primeiro", variant: "destructive" });
      return;
    }
    const digits = rawPhone(phone);
    if (digits.length !== 11) {
      toast({ title: "Número inválido", description: "Digite um número com DDD + 9 dígitos.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const fullPhone = "55" + digits;

      // 1) Salva no perfil (RLS por auth_user_id)
      const { error: perfilError } = await supabase
        .from("perfis")
        .upsert(
          { auth_user_id: user.id, whatsapp_phone: fullPhone },
          { onConflict: "auth_user_id" }
        );
      if (perfilError) throw perfilError;

      // 2) Cria/atualiza whatsapp_users vinculado ao auth_user_id
      const { data: existing } = await supabase
        .from("whatsapp_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      let waUserId: string;

      if (existing) {
        waUserId = existing.id;
        const { error: updErr } = await supabase
          .from("whatsapp_users")
          .update({
            phone: fullPhone,
            nome: perfil.nome || null,
            sexo: perfil.sexoBiologico || null,
            data_nascimento: perfil.dataNascimento || null,
            condicoes: perfil.condicoes.length > 0 ? perfil.condicoes : null,
            historico_familiar: perfil.historicoFamiliar || null,
            onboarding_completo: true,
          })
          .eq("id", waUserId);
        if (updErr) throw updErr;
      } else {
        const { data: newUser, error: insErr } = await supabase
          .from("whatsapp_users")
          .insert({
            auth_user_id: user.id,
            phone: fullPhone,
            nome: perfil.nome || null,
            sexo: perfil.sexoBiologico || null,
            data_nascimento: perfil.dataNascimento || null,
            condicoes: perfil.condicoes.length > 0 ? perfil.condicoes : null,
            historico_familiar: perfil.historicoFamiliar || null,
            onboarding_completo: true,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        waUserId = newUser!.id;
      }

      // 3) Sincroniza últimos 5 exames (best-effort, não quebra se falhar)
      const recentExams = exames.slice(0, 5);
      let syncedCount = 0;
      for (const exam of recentExams) {
        const { error: examErr } = await supabase.from("whatsapp_exames").insert({
          auth_user_id: user.id,
          user_id: waUserId,
          tipo: exam.tipo,
          nome: exam.nome,
          sistema: exam.sistema || null,
          data_coleta: exam.data || null,
          laboratorio: exam.laboratorio || null,
          texto_original: exam.textoOriginal,
          resumo: exam.resumo || null,
          resultado_json: (exam.resultado as any) || null,
        });
        if (!examErr) syncedCount++;
      }

      setConnected(true);
      setConnectedPhone(fullPhone);
      toast({
        title: "WhatsApp conectado!",
        description: syncedCount > 0
          ? `${syncedCount} exame(s) sincronizado(s).`
          : "Você já pode receber lembretes.",
      });
    } catch (err: any) {
      console.error("WhatsApp connect error:", err);
      toast({
        title: "Erro ao conectar",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await supabase.functions.invoke("whatsapp-inbound", {
        body: { phone: connectedPhone, text: { message: "ajuda" } },
      });
      toast({ title: "Mensagem de teste enviada!", description: "Verifique seu WhatsApp." });
    } catch {
      toast({ title: "Erro ao enviar teste", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const displayPhone = connectedPhone
    ? `+${connectedPhone.slice(0, 2)} (${connectedPhone.slice(2, 4)}) ${connectedPhone.slice(4, 9)}-${connectedPhone.slice(9)}`
    : "";

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-[#25D366]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">WhatsApp</h3>
          <p className="text-xs text-muted-foreground">Lembretes e explicações no seu celular</p>
        </div>
      </div>

      {connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="w-4 h-4 text-[#25D366]" />
            <span>Conectado: <strong className="text-foreground">{displayPhone}</strong></span>
          </div>
          <button
            onClick={handleTest}
            disabled={testing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium
              bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {testing ? "Enviando..." : "Enviar mensagem de teste"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="tel"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm
              focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 placeholder:text-muted-foreground/50"
          />
          <button
            onClick={handleConnect}
            disabled={loading || rawPhone(phone).length < 11}
            className="w-full py-3 rounded-lg text-sm font-medium transition-all active:scale-[0.97]
              bg-[#25D366] text-white hover:bg-[#25D366]/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? "Conectando..." : "Conectar WhatsApp"}
          </button>
        </div>
      )}
    </div>
  );
}

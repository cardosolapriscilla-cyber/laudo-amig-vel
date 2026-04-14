import { useState, useEffect } from "react";
import { MessageCircle, Check, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useExamStore } from "@/stores/examStore";
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
  const [phone, setPhone] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectedPhone, setConnectedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  // Check localStorage for existing connection
  useEffect(() => {
    const saved = localStorage.getItem("whatsapp_phone");
    if (saved) {
      setConnected(true);
      setConnectedPhone(saved);
    }
  }, []);

  const handleConnect = async () => {
    const digits = rawPhone(phone);
    if (digits.length !== 11) {
      toast({ title: "Número inválido", description: "Digite um número com DDD + 9 dígitos.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const fullPhone = "55" + digits;

      // Upsert whatsapp_users
      const { data: existing } = await supabase
        .from("whatsapp_users")
        .select("id")
        .eq("phone", fullPhone)
        .maybeSingle();

      let userId: string;

      if (existing) {
        userId = existing.id;
        await supabase.from("whatsapp_users").update({
          nome: perfil.nome || null,
          sexo: perfil.sexoBiologico || null,
          data_nascimento: perfil.dataNascimento || null,
          condicoes: perfil.condicoes.length > 0 ? perfil.condicoes : null,
          historico_familiar: perfil.historicoFamiliar || null,
          onboarding_completo: true,
        }).eq("id", userId);
      } else {
        const { data: newUser } = await supabase.from("whatsapp_users").insert({
          phone: fullPhone,
          nome: perfil.nome || null,
          sexo: perfil.sexoBiologico || null,
          data_nascimento: perfil.dataNascimento || null,
          condicoes: perfil.condicoes.length > 0 ? perfil.condicoes : null,
          historico_familiar: perfil.historicoFamiliar || null,
          onboarding_completo: true,
        }).select("id").single();
        userId = newUser!.id;
      }

      // Sync last 5 exams
      const recentExams = exames.slice(0, 5);
      for (const exam of recentExams) {
        await supabase.from("whatsapp_exames").insert({
          user_id: userId,
          tipo: exam.tipo,
          nome: exam.nome,
          sistema: exam.sistema || null,
          data_coleta: exam.data || null,
          laboratorio: exam.laboratorio || null,
          texto_original: exam.textoOriginal,
          resumo: exam.resumo || null,
          resultado_json: exam.resultado as any || null,
        });
      }

      localStorage.setItem("whatsapp_phone", fullPhone);
      setConnected(true);
      setConnectedPhone(fullPhone);
      toast({ title: "WhatsApp conectado!", description: `${recentExams.length} exame(s) sincronizado(s).` });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao conectar", description: "Tente novamente.", variant: "destructive" });
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

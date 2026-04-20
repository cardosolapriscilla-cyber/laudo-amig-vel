import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";

const ESPECIALIDADES = [
  "Cardiologista",
  "Endocrinologista",
  "Hepatologista",
  "Nefrologista",
  "Clínico Geral",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ShareWithDoctorSheet({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [especialidade, setEspecialidade] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = token ? `${window.location.origin}/briefing/${token}` : "";

  const handleGenerate = async () => {
    if (!especialidade || !user) return;
    setLoading(true);
    setToken(null);

    try {
      const especMap: Record<string, string> = {
        "Clínico Geral": "Clínico",
      };
      const especParaApi = especMap[especialidade] || especialidade;

      const { data, error } = await supabase.functions.invoke("generate-briefing", {
        body: { auth_user_id: user.id, especialidade: especParaApi },
      });

      if (error) throw error;
      if (!data?.token) throw new Error("Token não retornado");

      setToken(data.token);
    } catch (e: any) {
      console.error("Erro ao gerar briefing:", e);
      toast.error("Não foi possível gerar o briefing. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = `Segue meu histórico de saúde: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setToken(null);
      setEspecialidade("");
      setLoading(false);
    }
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh]">
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-xl">Preparar briefing para consulta</SheetTitle>
          <SheetDescription>
            Gere um resumo do seu histórico para compartilhar com seu médico.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {!token && !loading && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Especialidade</label>
                <Select value={especialidade} onValueChange={setEspecialidade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESPECIALIDADES.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!especialidade}
                className="w-full"
                size="lg"
              >
                Gerar link
              </Button>

              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                O briefing fica disponível por 72h e pode ser acessado sem login pelo médico.
              </p>
            </>
          )}

          {loading && (
            <div className="py-10 text-center">
              <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
              <p className="text-sm text-muted-foreground mt-4">Preparando briefing...</p>
              <p className="text-xs text-muted-foreground mt-1">Pode levar até 30 segundos</p>
            </div>
          )}

          {token && !loading && (
            <div className="space-y-4 animate-reveal">
              <div className="bg-sage-light rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Link do briefing</p>
                <p className="text-xs text-foreground break-all font-mono">{link}</p>
              </div>

              <Button
                onClick={handleCopy}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" /> Copiar link
                  </>
                )}
              </Button>

              <Button
                onClick={handleWhatsApp}
                className="w-full bg-[#25D366] hover:bg-[#1fb855] text-white"
                size="lg"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Compartilhar via WhatsApp
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

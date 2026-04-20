import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar link mágico");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-5 pt-20 pb-6 max-w-md mx-auto min-h-screen">
      <div className="text-center animate-reveal">
        <div className="w-14 h-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
          <Leaf className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Entre na Nauta</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Receba um link mágico no seu email para entrar com segurança.
        </p>
      </div>

      {sent ? (
        <div className="mt-10 bg-card rounded-xl p-6 shadow-sm text-center animate-reveal">
          <div className="w-12 h-12 rounded-full bg-sage-light flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-primary" />
          </div>
          <p className="text-base font-medium">Verifique seu email</p>
          <p className="text-sm text-muted-foreground mt-2">
            Enviamos um link para <span className="font-medium text-foreground">{email}</span>.
            Clique nele para entrar.
          </p>
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="mt-5 text-xs text-primary font-medium active:scale-95 transition-transform"
          >
            Usar outro email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="mt-10 space-y-5 animate-reveal animate-reveal-delay-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Seu email
            </label>
            <div className="mt-2 relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-card rounded-lg border border-border text-sm
                  placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!email.trim() || sending}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm
              shadow-md shadow-primary/15 disabled:opacity-40 disabled:shadow-none
              hover:shadow-lg active:scale-[0.97] transition-all duration-200
              flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
              </>
            ) : (
              "Entrar com link mágico"
            )}
          </button>

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Sem senha. Sem complicação. Seus dados ficam protegidos.
          </p>
        </form>
      )}
    </div>
  );
}

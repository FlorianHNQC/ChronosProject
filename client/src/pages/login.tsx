import { useState } from "react";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, ArrowLeft } from "lucide-react";

export function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest("POST", "/api/auth/login", { email, password });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/admin");
    } catch (err) {
      toast({ title: "Connexion refusée", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-24 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[110px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        <div className="mb-8 flex justify-center">
          <img src="/chronos-logo.png" alt="CHRONOS" className="h-20 w-auto" />
        </div>

        <Card className="p-6">
          <h1 className="flex items-center gap-2 text-xl font-bold italic">
            <LogIn className="h-5 w-5 not-italic text-primary" /> Connexion admin
          </h1>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Accès réservé à l'administration Chronos.</p>
          <form onSubmit={submit} className="space-y-3">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" autoComplete="username" />
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" />
            <Button type="submit" className="w-full gap-2" disabled={busy || !email || !password}>
              <LogIn className="h-4 w-4" />
              {busy ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </Card>

        <div className="mt-4 text-center">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

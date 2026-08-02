import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogIn, Lock, Sparkles } from "lucide-react";

/**
 * Écran public « bientôt disponible ».
 * Le site est verrouillé pour les visiteurs le temps de la refonte ; seul un
 * admin peut déverrouiller l'accès en se connectant (voir le gate dans App.tsx).
 * Structure inspirée d'un composant coming-soon 21st.dev, rebrandée Chronos.
 */
export function ComingSoonPage() {
  return (
    <section className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-background px-6 py-12 text-center text-foreground">
      {/* Halo ambré ambiant */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[130px]" />
        <div className="absolute -bottom-40 -right-24 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <img
          src="/chronos-logo.png"
          alt="CHRONOS"
          className="h-24 w-auto animate-fade-in-up object-contain sm:h-28"
        />

        <div className="flex animate-fade-in-up animate-delay-100 flex-col items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Communauté Brawl Stars
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="text-gradient-gold">Bientôt disponible</span>
          </h1>
          <p className="max-w-md text-sm text-muted-foreground sm:text-base">
            La nouvelle plateforme de la scène compétitive Chronos arrive. On met les
            dernières touches — reviens très vite.
          </p>
        </div>

        <div className="flex animate-fade-in-up animate-delay-200 flex-col items-center gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link href="/login">
              <LogIn className="h-4 w-4" /> Se connecter en tant qu'admin
            </Link>
          </Button>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Accès réservé à l'administration pour le moment
          </span>
        </div>
      </div>
    </section>
  );
}

export default ComingSoonPage;

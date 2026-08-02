import { useEffect, useState } from "react";

/**
 * Écran de démarrage animé (repris de leaguebs) : logo + barre de progression.
 * Affiché une seule fois par session (voir App.tsx / sessionStorage).
 */
export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 2200;
    const interval = 40;
    const increment = 100 / (duration / interval);
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 200);
          return 100;
        }
        return next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-4">
        <img
          src="/chronos-logo.png"
          alt="CHRONOS"
          className="h-28 w-auto animate-pulse object-contain sm:h-36"
        />

        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <div className="relative h-4 w-full">
            <div className="absolute inset-0 overflow-hidden rounded-sm border border-border bg-muted/50">
              <div
                className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="absolute -top-6 right-0 font-mono text-sm text-muted-foreground">
              {Math.round(progress)}%
            </div>
          </div>
          <div className="font-mono text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Loading
            <span className="inline-block w-6">{progress < 100 && <span className="animate-pulse">...</span>}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SplashScreen;

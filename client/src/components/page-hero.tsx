import type { ReactNode } from "react";

/**
 * Bandeau de titre réutilisable : titre (+ sous-titre) centré sur une image de
 * fond discrète, dans le même cadre que la page d'accueil. L'image est un fichier
 * statique de client/public/images/ (servi à /images/...) ; si elle manque, le
 * bandeau reste propre (fond neutre).
 */
export function PageHero({
  title,
  subtitle,
  image,
  children,
}: {
  title: string;
  subtitle?: string;
  image: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border mb-6">
      <div className="absolute inset-0 bg-muted bg-cover bg-center" style={{ backgroundImage: `url("${image}")` }} aria-hidden />
      <div className="absolute inset-0 bg-background/85" aria-hidden />
      <div className="relative px-6 py-9 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}

export default PageHero;

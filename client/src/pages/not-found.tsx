import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-sm text-muted-foreground">Cette page n'existe pas.</p>
      <Link href="/" className="text-primary underline underline-offset-4">
        Retour à l'accueil
      </Link>
    </div>
  );
}

import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMe } from "@/hooks/use-me";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Image as ImageIcon } from "lucide-react";

type SettingValue = { key: string; value: string | null };

/**
 * Bandeau de titre réutilisable. Chaque page a SA propre image (réglage
 * `settingKey`, ex. « hero_hydra »), modifiable en ligne par un admin depuis la
 * page elle-même. À distinguer du fond global du site (réglage « home_bg »),
 * appliqué derrière tout le contenu dans le layout.
 */
export function PageHero({
  title,
  subtitle,
  settingKey,
  defaultImage,
  large = false,
  children,
}: {
  title: string;
  subtitle?: string;
  settingKey: string;
  defaultImage: string;
  large?: boolean;
  children?: ReactNode;
}) {
  const url = `/api/settings/${settingKey}`;
  const { data: setting } = useQuery<SettingValue>({ queryKey: [url] });
  const bg = setting?.value || defaultImage;
  const { isAdmin } = useMe();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const save = useMutation({
    mutationFn: () => apiRequest("PUT", url, { value: input.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [url] });
      setEditing(false);
      toast({ title: "Bandeau mis à jour" });
    },
    onError: (e: Error) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <section className="relative overflow-hidden rounded-2xl border mb-6">
      <div className="absolute inset-0 bg-muted bg-cover bg-center" style={{ backgroundImage: `url("${bg}")` }} aria-hidden />
      <div className="absolute inset-0 bg-background/85" aria-hidden />
      <div className={"relative text-center px-6 " + (large ? "py-16 sm:py-20" : "py-9")}>
        <h1 className={(large ? "text-5xl" : "text-3xl") + " font-extrabold tracking-tight text-primary"}>{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
        {children}
        {isAdmin && (
          <div className="mt-4">
            {editing ? (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="/images/….webp ou une URL (vide = défaut)"
                  className="w-80 max-w-full"
                />
                <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { setInput(setting?.value ?? ""); setEditing(true); }}>
                <ImageIcon className="h-4 w-4 mr-1" /> Changer l'image du bandeau
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default PageHero;

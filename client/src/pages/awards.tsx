import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { PageHero } from "@/components/page-hero";
import { UserRound, Trophy, Sparkles } from "lucide-react";

type Recipient = {
  playerId: string | null;
  pseudo: string;
  avatarUrl: string | null;
  team: string | null;
  conference: string | null;
  conferenceColor: string | null;
};
type AwardCard = {
  id: string;
  competitionId: string | null;
  competitionName: string | null;
  title: string;
  subtitle: string | null;
  justification: string | null;
  recipientType: string;
  accent: string | null;
  featured: boolean;
  teamName: string | null;
  teamLogo: string | null;
  recipients: Recipient[];
  freeText: string | null;
};

const DEFAULT_ACCENT = "#EAB308";

function Avatar({ r, size }: { r: Recipient; size: number }) {
  const inner = r.avatarUrl ? (
    <img src={r.avatarUrl} alt={r.pseudo} className="h-full w-full object-cover" />
  ) : (
    <div className="h-full w-full flex items-center justify-center bg-muted">
      <UserRound className="h-1/2 w-1/2 text-muted-foreground" />
    </div>
  );
  const box = (
    <div className="rounded-xl overflow-hidden ring-2" style={{ width: size, height: size, boxShadow: "0 4px 14px -6px rgba(0,0,0,0.6)" }}>
      {inner}
    </div>
  );
  return r.playerId ? <Link href={`/joueurs/${r.playerId}`}>{box}</Link> : box;
}

function ConfBadge({ r }: { r: Recipient }) {
  if (!r.conference && !r.team) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1 justify-center flex-wrap">
      {r.team && <span className="text-[11px] text-muted-foreground">{r.team}</span>}
      {r.conference && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: r.conferenceColor ?? "#666" }}>
          {r.conference}
        </span>
      )}
    </div>
  );
}

function Recipients({ card }: { card: AwardCard }) {
  const big = card.featured;
  if (card.recipientType === "text") {
    return <div className={"font-bold text-center " + (big ? "text-2xl" : "text-lg")}>{card.freeText}</div>;
  }
  if (card.recipients.length === 0) {
    return <div className="text-sm text-muted-foreground text-center">—</div>;
  }
  // Un seul récipiendaire (joueur) : mise en avant verticale.
  if (card.recipients.length === 1) {
    const r = card.recipients[0];
    return (
      <div className="flex flex-col items-center gap-2">
        <Avatar r={r} size={big ? 96 : 64} />
        <div className={"font-extrabold leading-tight text-center " + (big ? "text-2xl" : "text-lg")}>{r.pseudo}</div>
        <ConfBadge r={r} />
      </div>
    );
  }
  // Plusieurs récipiendaires (best team / roster) : rangée d'avatars.
  return (
    <div>
      {card.teamName && <div className="text-center font-bold mb-3">{card.teamName}</div>}
      <div className="flex flex-wrap justify-center gap-4">
        {card.recipients.map((r, i) => (
          <div key={(r.playerId ?? "") + i} className="flex flex-col items-center gap-1 w-20">
            <Avatar r={r} size={56} />
            <div className="text-xs font-semibold text-center leading-tight truncate w-full">{r.pseudo}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AwardTile({ card, index }: { card: AwardCard; index: number }) {
  const accent = card.accent || DEFAULT_ACCENT;
  return (
    <motion.div
      initial={{ opacity: 0, y: 26, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: "easeOut", delay: (index % 6) * 0.06 }}
      whileHover={{ y: -4 }}
      className={"relative overflow-hidden rounded-2xl border bg-card p-6 " + (card.featured ? "md:col-span-2" : "")}
      style={{ boxShadow: `0 10px 40px -18px ${accent}` }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-20"
        style={{ background: accent }}
      />
      <div className="relative">
        <div className="flex items-center justify-center gap-2 mb-1">
          {card.featured ? <Trophy className="h-4 w-4" style={{ color: accent }} /> : <Sparkles className="h-4 w-4" style={{ color: accent }} />}
          <div className="text-xs uppercase tracking-[0.15em] font-bold text-center" style={{ color: accent }}>{card.title}</div>
        </div>
        {card.subtitle && <div className="text-xs text-muted-foreground text-center mb-4">{card.subtitle}</div>}
        {!card.subtitle && <div className="mb-4" />}
        <Recipients card={card} />
        {card.justification && (
          <p className="text-sm text-muted-foreground text-center mt-4 max-w-xl mx-auto leading-relaxed">{card.justification}</p>
        )}
      </div>
    </motion.div>
  );
}

/** Palmarès : awards de cérémonie, groupés par compétition (plus récente d'abord), animés. */
export function AwardsPage() {
  const { data: cards } = useQuery<AwardCard[]>({ queryKey: ["/api/palmares"] });

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, { name: string; cards: AwardCard[] }>();
    for (const c of cards ?? []) {
      const key = c.competitionId ?? "none";
      if (!map.has(key)) {
        map.set(key, { name: c.competitionName ?? "Sans compétition", cards: [] });
        order.push(key);
      }
      map.get(key)!.cards.push(c);
    }
    return order.map((k) => map.get(k)!);
  }, [cards]);

  return (
    <div className="w-full px-6 py-8">
      <PageHero title="Récompenses" subtitle="Palmarès des cérémonies" settingKey="hero_recompenses" defaultImage="/images/recompenses.webp" />

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune récompense pour l'instant.</p>
      ) : (
        groups.map((g) => (
          <section key={g.name} className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <Trophy className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">{g.name}</h2>
              <span className="text-xs text-muted-foreground">· {g.cards.length} récompenses</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {g.cards.map((c, i) => (
                <AwardTile key={c.id} card={c} index={i} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export default AwardsPage;

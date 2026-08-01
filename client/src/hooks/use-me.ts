import { useQuery } from "@tanstack/react-query";

export type Me = { id: string; email: string; role: string } | null;

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

/** Session courante (ou null). `isAdmin` = connecté avec le rôle admin. */
export function useMe() {
  const query = useQuery<Me>({
    queryKey: ["/api/auth/me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });
  return { ...query, isAdmin: !!query.data && query.data.role === "admin" };
}

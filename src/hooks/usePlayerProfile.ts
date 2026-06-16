import { useQuery } from "@tanstack/react-query";
import { fetchPlayerProfile } from "../api/espn";

export function usePlayerProfile(playerId: string | null | undefined) {
  return useQuery({
    queryKey: ["playerProfile", playerId],
    queryFn: () => fetchPlayerProfile(playerId!),
    enabled: !!playerId,
    staleTime: 60 * 60 * 1000,
  });
}

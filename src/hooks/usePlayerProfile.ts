import { useQuery } from "@tanstack/react-query";
import { fetchPlayerProfile } from "../api/espn";
import { queryKeys } from "./queryKeys";

export function usePlayerProfile(playerId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.playerProfile(playerId),
    queryFn: () => fetchPlayerProfile(playerId!),
    enabled: !!playerId,
    staleTime: 60 * 60 * 1000,
  });
}

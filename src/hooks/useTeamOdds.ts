import { useQuery } from "@tanstack/react-query";
import { fetchTeamOdds } from "../api/polymarket";
import { POLYMARKET_CACHE_TTL } from "../constants";

export function useTeamOdds(teamName: string) {
  return useQuery({
    queryKey: ["teamOdds", teamName],
    queryFn: () => fetchTeamOdds(teamName),
    staleTime: POLYMARKET_CACHE_TTL,
    retry: 1,
  });
}

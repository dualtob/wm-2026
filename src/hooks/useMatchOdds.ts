import { useQuery } from "@tanstack/react-query";
import { fetchMatchOdds } from "../api/polymarket";
import { POLYMARKET_CACHE_TTL } from "../constants";
import { queryKeys } from "./queryKeys";

export function useMatchOdds(team1: string, team2: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.matchOdds(team1, team2),
    queryFn: () => fetchMatchOdds(team1, team2),
    staleTime: POLYMARKET_CACHE_TTL,
    enabled,
    retry: 1,
  });
}

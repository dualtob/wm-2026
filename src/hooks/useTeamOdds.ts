import { useQuery } from "@tanstack/react-query";
import { fetchTeamOdds } from "../api/polymarket";
import { POLYMARKET_CACHE_TTL } from "../constants";
import { queryKeys } from "./queryKeys";

export function useTeamOdds(teamName: string) {
  return useQuery({
    queryKey: queryKeys.teamOdds(teamName),
    queryFn: () => fetchTeamOdds(teamName),
    staleTime: POLYMARKET_CACHE_TTL,
    retry: 1,
  });
}

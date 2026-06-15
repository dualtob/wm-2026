import { useQuery } from "@tanstack/react-query";
import { fetchChampionOdds } from "../api/polymarket";
import { POLYMARKET_CACHE_TTL } from "../constants";

export function useChampionOdds() {
  return useQuery({
    queryKey: ["championOdds"],
    queryFn: fetchChampionOdds,
    staleTime: POLYMARKET_CACHE_TTL,
    retry: 1,
  });
}

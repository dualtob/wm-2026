import { useQuery } from "@tanstack/react-query";
import { fetchChampionOdds } from "../api/polymarket";
import { POLYMARKET_CACHE_TTL } from "../constants";
import { queryKeys } from "./queryKeys";

export function useChampionOdds() {
  return useQuery({
    queryKey: queryKeys.championOdds(),
    queryFn: fetchChampionOdds,
    staleTime: POLYMARKET_CACHE_TTL,
    retry: 1,
  });
}

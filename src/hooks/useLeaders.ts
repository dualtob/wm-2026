import { useQuery } from "@tanstack/react-query";
import { fetchLeaders } from "../api/espn";
import { WC2026 } from "../leagues/wc2026";
import { queryKeys } from "./queryKeys";

export function useLeaders() {
  return useQuery({
    queryKey: queryKeys.leaders(),
    queryFn: () => fetchLeaders(WC2026),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

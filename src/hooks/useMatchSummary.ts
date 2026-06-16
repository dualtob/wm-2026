import { useQuery } from "@tanstack/react-query";
import { fetchMatchSummary } from "../api/espn";

// Shared between StatsTab (Phase 2) and LineupTab (Phase 3) — the summary
// endpoint returns both boxscore and rosters in one call, so we cache once.
export function useMatchSummary(espnId: string | null | undefined) {
  return useQuery({
    queryKey: ["matchSummary", espnId],
    queryFn: () => fetchMatchSummary(espnId!),
    enabled: !!espnId,
    staleTime: 60_000,
  });
}

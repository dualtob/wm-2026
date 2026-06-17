import { useQueryClient, useQuery } from "@tanstack/react-query";
import { fetchMatchDetail } from "../api/espn";
import { queryKeys } from "./queryKeys";

// Tries the scoreboard cache first (instant, no network), then falls back to
// fetching the dedicated match detail endpoint.
export function useMatchGoals(espnId: string | null | undefined) {
  const queryClient = useQueryClient();

  // Look up the event in the already-fetched scoreboard data
  const scoreboard = queryClient.getQueryData<unknown[]>(queryKeys.scoreboard());
  const cachedEvent = scoreboard?.find((e) => {
    const ev = e as { id?: string | number };
    return String(ev.id) === String(espnId);
  });

  // Only fetch the detail endpoint when the scoreboard cache has no entry
  const { data: detailData, isLoading } = useQuery({
    queryKey: queryKeys.matchDetail(espnId),
    queryFn: () => fetchMatchDetail(espnId!),
    enabled: !!espnId && !cachedEvent,
    staleTime: 30_000,
  });

  if (cachedEvent) return { data: cachedEvent, isLoading: false };
  return { data: detailData, isLoading };
}

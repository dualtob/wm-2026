import { useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMatchCommentary } from "../api/espn";

const LIVE_INTERVAL = 30_000;

// Polls the summary commentary every 30s for live matches.
// Stable callback (ref-backed) so changing isLive does not reset the timer.
export function useLivePlays(espnId: string | null | undefined, isLive: boolean) {
  const isLiveRef = useRef(isLive);
  isLiveRef.current = isLive;

  const refetchInterval = useCallback(
    () => (isLiveRef.current ? LIVE_INTERVAL : false),
    []
  );

  return useQuery({
    queryKey: ["liveCommentary", espnId],
    queryFn: () => fetchMatchCommentary(espnId!),
    enabled: !!espnId,
    staleTime: 0,
    refetchInterval,
  });
}

import { useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFixtures } from "../api/fixtures";
import { fetchScoreboard } from "../api/espn";
import { FIXTURES_CACHE_TTL, LIVE_POLL_INTERVAL, LIVE_POLL_INTERVAL_ACTIVE } from "../constants";

export function useFixtures() {
  return useQuery({
    queryKey: ["fixtures"],
    queryFn: fetchFixtures,
    staleTime: FIXTURES_CACHE_TTL,
  });
}

export function useScoreboard(hasLive: boolean) {
  // Keep a ref so the interval function always reads the latest value without
  // causing TanStack Query to see a changed refetchInterval and reset the timer.
  const hasLiveRef = useRef(hasLive);
  hasLiveRef.current = hasLive;

  const getInterval = useCallback(
    () => (hasLiveRef.current ? LIVE_POLL_INTERVAL_ACTIVE : LIVE_POLL_INTERVAL),
    [] // stable reference — reads through ref at call time
  );

  return useQuery({
    queryKey: ["scoreboard"],
    queryFn: fetchScoreboard,
    staleTime: 0,
    refetchInterval: getInterval,
  });
}

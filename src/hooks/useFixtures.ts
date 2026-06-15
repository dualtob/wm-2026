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
  return useQuery({
    queryKey: ["scoreboard"],
    queryFn: fetchScoreboard,
    staleTime: 0,
    refetchInterval: hasLive ? LIVE_POLL_INTERVAL_ACTIVE : LIVE_POLL_INTERVAL,
  });
}

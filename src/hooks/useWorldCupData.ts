import { useMemo, useRef } from "react";
import { computeStandings, mergeEspnScores } from "../api/fixtures";
import { useFixtures, useScoreboard } from "./useFixtures";
import { useChampionOdds } from "./useChampionOdds";

export function useWorldCupData() {
  const { data: fixturesResult, isLoading, isFetching, isError, error, refetch } = useFixtures();
  const rawMatches = fixturesResult?.matches ?? [];

  // Track whether any merged match is live so the scoreboard can poll faster.
  // We use a ref here to break the ordering dependency: useScoreboard must be
  // called before we compute matches, but hasLive depends on merged matches.
  // The ref holds the value from the previous render; it is updated below after
  // the merge, so the NEXT render passes the correct hasLive to useScoreboard.
  const hasLiveRef = useRef(false);
  const { data: scoreboard } = useScoreboard(hasLiveRef.current);

  const matches = useMemo(
    () => mergeEspnScores(rawMatches, scoreboard ?? []),
    [rawMatches, scoreboard]
  );

  // Update the ref for the next render — does not trigger a re-render.
  hasLiveRef.current = matches.some((m) => m.isLive);

  const standings = useMemo(() => computeStandings(matches), [matches]);
  const { data: championOdds } = useChampionOdds();

  const liveMatches = useMemo(() => matches.filter((m) => m.isLive), [matches]);

  const upcomingMatches = useMemo(
    () =>
      matches
        .filter((m) => !m.played && !m.isLive && !m.isPlaceholder)
        .sort((a, b) => (a.kickoff?.getTime() ?? Infinity) - (b.kickoff?.getTime() ?? Infinity)),
    [matches]
  );

  const resultMatches = useMemo(
    () =>
      matches
        .filter((m) => m.played && !m.isPlaceholder)
        .sort((a, b) => (b.kickoff?.getTime() ?? 0) - (a.kickoff?.getTime() ?? 0)),
    [matches]
  );

  return {
    matches,
    standings,
    liveMatches,
    upcomingMatches,
    resultMatches,
    championOdds,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  };
}

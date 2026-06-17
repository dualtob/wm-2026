import { useMemo, useState, useEffect } from "react";
import { computeStandings, mergeEspnScores } from "../api/fixtures";
import { useFixtures, useScoreboard } from "./useFixtures";
import { useChampionOdds } from "./useChampionOdds";

export function useWorldCupData() {
  const { data: fixturesResult, isLoading, isFetching, isError, error, refetch } = useFixtures();
  const rawMatches = fixturesResult?.matches ?? [];

  // hasLive drives the scoreboard poll rate (60s → 10s when a match is live).
  // State is used (not a ref) so that switching to active mode actually triggers
  // a re-render that passes the new value into useScoreboard's internal ref.
  const [hasLive, setHasLive] = useState(false);
  const { data: scoreboard } = useScoreboard(hasLive);

  const matches = useMemo(
    () => mergeEspnScores(rawMatches, scoreboard ?? []),
    [rawMatches, scoreboard]
  );

  const liveMatches = useMemo(() => matches.filter((m) => m.isLive), [matches]);

  useEffect(() => {
    setHasLive(liveMatches.length > 0);
  }, [liveMatches.length]);

  const standings = useMemo(() => computeStandings(matches), [matches]);
  const { data: championOdds } = useChampionOdds();

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

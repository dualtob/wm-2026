/**
 * RED tests — these MUST FAIL until multi-league modularization is implemented.
 *
 * Two behavioral gaps that block Bundesliga / Premier League support:
 *
 * 1. computeStandings: league fixtures have group=null; current code skips those
 *    matches entirely. A league mode should bucket all matches under a single
 *    "League" key so the standings table renders.
 *
 * 2. mergeEspnScores: club name aliases are missing. ESPN returns long official
 *    names ("FC Bayern Munich") while OpenFootball uses short names ("Bayern Munich").
 *    normalizeTeamName has no club alias map, so the sorted key never matches and
 *    scores are never merged.
 */
import { describe, it, expect } from "vitest";
import { computeStandings, mergeEspnScores } from "./fixtures";
import type { Match } from "../types";

function makeLeagueMatch(
  team1: string,
  team2: string,
  score: [number, number] | null
): Match {
  return {
    id: `${team1}-${team2}`,
    kickoff: null,
    group: null,       // ← league matches have no group
    stage: "Matchday 1",
    matchday: 1,
    venue: null,
    city: null,
    team1: { name: team1, abbr: team1.slice(0, 3).toUpperCase(), espnId: "1", color: "000000" },
    team2: { name: team2, abbr: team2.slice(0, 3).toUpperCase(), espnId: "2", color: "000000" },
    score: score ? { home: score[0], away: score[1] } : null,
    played: score !== null,
    isPlaceholder: false,
  };
}

const ESPN_STATE: Record<string, string> = {
  STATUS_FINAL: "post",
  STATUS_FULL_TIME: "post",
  STATUS_IN_PROGRESS: "in",
  STATUS_FIRST_HALF: "in",
  STATUS_SECOND_HALF: "in",
  STATUS_HALFTIME: "in",
  STATUS_SCHEDULED: "pre",
};

function makeEspnEvent(
  homeName: string,
  awayName: string,
  homeScore: number,
  awayScore: number,
  status = "STATUS_FINAL"
) {
  return {
    id: "99",
    status: { type: { name: status, state: ESPN_STATE[status] ?? "pre" }, displayClock: "" },
    competitions: [
      {
        competitors: [
          { homeAway: "home", score: String(homeScore), team: { displayName: homeName } },
          { homeAway: "away", score: String(awayScore), team: { displayName: awayName } },
        ],
      },
    ],
  };
}

// ─── Gap 1: computeStandings ignores group=null matches ──────────────────────

describe("computeStandings — league mode (group=null matches)", () => {
  it('buckets group=null matches under "League" key', () => {
    // Currently returns {} because the guard `if (!m.group || ...)` skips these
    const s = computeStandings([
      makeLeagueMatch("Bayern Munich", "Dortmund", [3, 1]),
      makeLeagueMatch("Leverkusen", "Leipzig", [2, 0]),
    ]);
    expect(Object.keys(s)).toContain("League");
    expect(s["League"]).toHaveLength(4);
  });

  it("computes points correctly for league standings", () => {
    const s = computeStandings([makeLeagueMatch("Bayern Munich", "Dortmund", [2, 0])]);
    const winner = s["League"]?.find((r) => r.team === "Bayern Munich");
    expect(winner?.points).toBe(3);
  });
});

// ─── Gap 2: mergeEspnScores can't match club name aliases ────────────────────

describe("mergeEspnScores — club name normalization", () => {
  it('matches "FC Bayern Munich" (ESPN) to "Bayern Munich" (fixture)', () => {
    // Currently returns score=null because the sorted keys differ:
    // ESPN key: "Borussia Dortmund|FC Bayern Munich"
    // Fixture key: "Bayern Munich|Dortmund"
    const fixtures = [makeLeagueMatch("Bayern Munich", "Dortmund", null)];
    const events = [makeEspnEvent("FC Bayern Munich", "Borussia Dortmund", 3, 1)];
    const merged = mergeEspnScores(fixtures, events);
    expect(merged[0].score).toEqual({ home: 3, away: 1 });
    expect(merged[0].played).toBe(true);
  });

  it('matches "Manchester City FC" (ESPN) to "Manchester City" (fixture)', () => {
    const fixtures = [makeLeagueMatch("Manchester City", "Arsenal", null)];
    const events = [makeEspnEvent("Manchester City FC", "Arsenal FC", 2, 0)];
    const merged = mergeEspnScores(fixtures, events);
    expect(merged[0].score).toEqual({ home: 2, away: 0 });
  });
});

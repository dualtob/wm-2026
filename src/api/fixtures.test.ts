import { describe, it, expect } from "vitest";
import { computeStandings, mergeEspnScores } from "./fixtures";
import type { Match } from "../types";

// ─── Factories ───────────────────────────────────────────────────────────────

function makeMatch(
  team1: string,
  team2: string,
  score: [number, number] | null,
  group: string | null = "Group A"
): Match {
  return {
    id: `${team1}-${team2}`,
    kickoff: null,
    group,
    stage: group ?? "Round of 16",
    matchday: null,
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
  status = "STATUS_FINAL",
  clock = ""
) {
  return {
    id: "999",
    status: { type: { name: status, state: ESPN_STATE[status] ?? "pre" }, displayClock: clock },
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

// ─── computeStandings ────────────────────────────────────────────────────────

describe("computeStandings", () => {
  it("awards 3 points to winner and 0 to loser", () => {
    const s = computeStandings([makeMatch("Germany", "France", [2, 1])]);
    const [first, second] = s["Group A"];
    expect(first).toMatchObject({ team: "Germany", points: 3, won: 1, lost: 0 });
    expect(second).toMatchObject({ team: "France", points: 0, won: 0, lost: 1 });
  });

  it("awards 1 point each for a draw", () => {
    const s = computeStandings([makeMatch("Germany", "France", [1, 1])]);
    expect(s["Group A"][0].points).toBe(1);
    expect(s["Group A"][1].points).toBe(1);
    expect(s["Group A"][0].drawn).toBe(1);
    expect(s["Group A"][1].drawn).toBe(1);
  });

  it("computes goals for and against correctly", () => {
    const s = computeStandings([makeMatch("Germany", "France", [3, 1])]);
    const ger = s["Group A"].find((r) => r.team === "Germany")!;
    const fra = s["Group A"].find((r) => r.team === "France")!;
    expect(ger.goalsFor).toBe(3);
    expect(ger.goalsAgainst).toBe(1);
    expect(ger.goalDiff).toBe(2);
    expect(fra.goalsFor).toBe(1);
    expect(fra.goalDiff).toBe(-2);
  });

  it("sorts by points, then goal difference, then goals for", () => {
    const s = computeStandings([
      makeMatch("Germany", "France",   [3, 0]),
      makeMatch("Spain",   "Portugal", [1, 0]),
      makeMatch("Germany", "Spain",    [0, 0]),
      makeMatch("France",  "Portugal", [2, 0]),
    ]);
    expect(s["Group A"].map((r) => r.team)).toEqual([
      "Germany",   // 7 pts, +3 GD
      "Spain",     // 4 pts, 0 GD
      "France",    // 3 pts, -1 GD
      "Portugal",  // 0 pts
    ]);
  });

  it("registers unplayed matches with zero stats for both teams", () => {
    const s = computeStandings([makeMatch("Germany", "France", null)]);
    expect(s["Group A"]).toHaveLength(2);
    expect(s["Group A"][0].played).toBe(0);
    expect(s["Group A"][0].points).toBe(0);
  });

  it("skips placeholder matches", () => {
    const m = { ...makeMatch("?A", "?B", [1, 0]), isPlaceholder: true };
    const s = computeStandings([m]);
    expect(Object.keys(s)).toHaveLength(0);
  });

  it("keeps groups separate", () => {
    const s = computeStandings([
      makeMatch("Germany", "France", [1, 0], "Group A"),
      makeMatch("Spain", "Portugal", [2, 1], "Group B"),
    ]);
    expect(Object.keys(s)).toHaveLength(2);
    expect(s["Group A"]).toHaveLength(2);
    expect(s["Group B"]).toHaveLength(2);
  });

  it("accumulates stats across multiple matches", () => {
    const s = computeStandings([
      makeMatch("Germany", "France",  [1, 0]),
      makeMatch("Germany", "Spain",   [2, 1]),
      makeMatch("France",  "Spain",   [0, 0]),
    ]);
    const ger = s["Group A"].find((r) => r.team === "Germany")!;
    expect(ger.played).toBe(2);
    expect(ger.points).toBe(6);
    expect(ger.goalsFor).toBe(3);
  });
});

// ─── mergeEspnScores ─────────────────────────────────────────────────────────

describe("mergeEspnScores", () => {
  it("merges score into matching fixture", () => {
    const fixtures = [makeMatch("Germany", "France", null)];
    const events = [makeEspnEvent("Germany", "France", 2, 1)];
    const merged = mergeEspnScores(fixtures, events);
    expect(merged[0].score).toEqual({ home: 2, away: 1 });
    expect(merged[0].played).toBe(true);
  });

  it("matches fixture by sorted team-pair key regardless of ESPN home/away designation", () => {
    // ESPN lists home=France, away=Germany; fixture is team1=Germany, team2=France
    // The sorted key ("France|Germany") matches in both directions
    const fixtures = [makeMatch("Germany", "France", null)];
    const events = [makeEspnEvent("France", "Germany", 1, 2)];
    const merged = mergeEspnScores(fixtures, events);
    // score.home/away follow ESPN's home/away designation, not fixture team1/team2
    expect(merged[0].score).toEqual({ home: 1, away: 2 });
  });

  it("marks STATUS_IN_PROGRESS as live with liveMinute", () => {
    const fixtures = [makeMatch("Germany", "France", null)];
    const events = [makeEspnEvent("Germany", "France", 1, 0, "STATUS_IN_PROGRESS", "67'")];
    const merged = mergeEspnScores(fixtures, events);
    expect(merged[0].isLive).toBe(true);
    expect(merged[0].liveMinute).toBe("67'");
    expect(merged[0].played).toBe(false);
  });

  it("marks STATUS_FINAL as played and not live", () => {
    const fixtures = [makeMatch("Germany", "France", null)];
    const events = [makeEspnEvent("Germany", "France", 1, 0, "STATUS_FINAL")];
    const merged = mergeEspnScores(fixtures, events);
    expect(merged[0].played).toBe(true);
    expect(merged[0].isLive).toBe(false);
  });

  it("leaves unmatched fixtures unchanged", () => {
    const fixtures = [makeMatch("Germany", "France", null)];
    const events = [makeEspnEvent("Spain", "Portugal", 1, 0)];
    const merged = mergeEspnScores(fixtures, events);
    expect(merged[0].score).toBeNull();
    expect(merged[0].played).toBe(false);
  });

  it("attaches espnId from the matched event", () => {
    const fixtures = [makeMatch("Germany", "France", null)];
    const events = [{ ...makeEspnEvent("Germany", "France", 1, 0), id: "42" }];
    const merged = mergeEspnScores(fixtures, events);
    expect(merged[0].espnId).toBe("42");
  });

  it("returns original array unchanged when events list is empty", () => {
    const fixtures = [makeMatch("Germany", "France", null)];
    const merged = mergeEspnScores(fixtures, []);
    expect(merged).toBe(fixtures);
  });
});

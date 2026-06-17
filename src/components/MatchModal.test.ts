import { describe, it, expect } from "vitest";
import {
  parseMatchEvents,
  parseMatchStats,
  parseMatchLineup,
  parseLivePlays,
  getCompetitionFromDetail,
} from "../api/espn-parsers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HOME_ESPN_ID = "100";
const AWAY_ESPN_ID = "200";

function makeCompetition(details: object[]) {
  return {
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { id: HOME_ESPN_ID } },
          { homeAway: "away", team: { id: AWAY_ESPN_ID } },
        ],
        details,
      },
    ],
  };
}

function makeDetail(overrides: object) {
  return {
    clock: { displayValue: "45'" },
    team: { id: HOME_ESPN_ID },
    athletesInvolved: [{ displayName: "Müller", id: "999" }],
    ...overrides,
  };
}

// ─── getCompetitionFromDetail ─────────────────────────────────────────────────

describe("getCompetitionFromDetail", () => {
  it("returns the first competition object", () => {
    const comp = { id: "1", competitors: [] };
    const data = { competitions: [comp] };
    expect(getCompetitionFromDetail(data)).toBe(comp);
  });

  it("returns undefined when competitions is missing", () => {
    expect(getCompetitionFromDetail({})).toBeUndefined();
    expect(getCompetitionFromDetail(null)).toBeUndefined();
  });
});

// ─── parseMatchEvents ─────────────────────────────────────────────────────────

describe("parseMatchEvents", () => {
  it("returns empty array when data has no competitions", () => {
    expect(parseMatchEvents({}, HOME_ESPN_ID)).toEqual([]);
    expect(parseMatchEvents(null, HOME_ESPN_ID)).toEqual([]);
  });

  it("parses a goal event for the home team", () => {
    const data = makeCompetition([
      makeDetail({ scoringPlay: true, ownGoal: false, penaltyKick: false }),
    ]);
    const events = parseMatchEvents(data, HOME_ESPN_ID);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "goal",
      minute: "45'",
      player: "Müller",
      playerId: "999",
      side: "home",
    });
  });

  it("parses own goal", () => {
    const data = makeCompetition([
      makeDetail({ scoringPlay: true, ownGoal: true, penaltyKick: false }),
    ]);
    expect(parseMatchEvents(data, HOME_ESPN_ID)[0].kind).toBe("ownGoal");
  });

  it("parses penalty kick goal", () => {
    const data = makeCompetition([
      makeDetail({ scoringPlay: true, ownGoal: false, penaltyKick: true }),
    ]);
    expect(parseMatchEvents(data, HOME_ESPN_ID)[0].kind).toBe("penalty");
  });

  it("parses yellow card (non-scoring)", () => {
    const data = makeCompetition([makeDetail({ yellowCard: true })]);
    expect(parseMatchEvents(data, HOME_ESPN_ID)[0].kind).toBe("yellowCard");
  });

  it("parses red card", () => {
    const data = makeCompetition([makeDetail({ redCard: true })]);
    expect(parseMatchEvents(data, HOME_ESPN_ID)[0].kind).toBe("redCard");
  });

  it("parses yellow-red card when both flags set", () => {
    const data = makeCompetition([makeDetail({ yellowCard: true, redCard: true })]);
    expect(parseMatchEvents(data, HOME_ESPN_ID)[0].kind).toBe("yellowRedCard");
  });

  it("assigns side=away when team id does not match home", () => {
    const data = makeCompetition([
      makeDetail({ scoringPlay: true, team: { id: AWAY_ESPN_ID } }),
    ]);
    expect(parseMatchEvents(data, HOME_ESPN_ID)[0].side).toBe("away");
  });

  it("skips detail entries that are neither scoring nor cards", () => {
    const data = makeCompetition([makeDetail({})]);
    expect(parseMatchEvents(data, HOME_ESPN_ID)).toHaveLength(0);
  });

  it("includes assist when assistsInvolved present", () => {
    const data = makeCompetition([
      makeDetail({
        scoringPlay: true,
        assistsInvolved: [{ displayName: "Klose" }],
      }),
    ]);
    expect(parseMatchEvents(data, HOME_ESPN_ID)[0].assist).toBe("Klose");
  });
});

// ─── parseMatchStats ──────────────────────────────────────────────────────────

function makeSummaryWithStats(
  homeStats: object[],
  awayStats: object[]
) {
  return {
    boxscore: {
      teams: [
        { homeAway: "home", team: { id: HOME_ESPN_ID }, statistics: homeStats },
        { homeAway: "away", team: { id: AWAY_ESPN_ID }, statistics: awayStats },
      ],
    },
  };
}

function stat(name: string, abbreviation: string, displayValue: string) {
  return { name, abbreviation, displayValue };
}

describe("parseMatchStats", () => {
  it("returns null when boxscore is missing", () => {
    expect(parseMatchStats({}, HOME_ESPN_ID)).toBeNull();
    expect(parseMatchStats({ boxscore: {} }, HOME_ESPN_ID)).toBeNull();
  });

  it("returns null when fewer than 2 teams", () => {
    const summary = { boxscore: { teams: [{ homeAway: "home", statistics: [] }] } };
    expect(parseMatchStats(summary, HOME_ESPN_ID)).toBeNull();
  });

  it("parses possession percentage", () => {
    const summary = makeSummaryWithStats(
      [stat("possessionPct", "POS", "60%")],
      [stat("possessionPct", "POS", "40%")]
    );
    const stats = parseMatchStats(summary, HOME_ESPN_ID)!;
    expect(stats.home.possession).toBe(60);
    expect(stats.away.possession).toBe(40);
  });

  it("parses shots on target by abbreviation", () => {
    const summary = makeSummaryWithStats(
      [stat("shotsOnGoal", "ST", "5")],
      [stat("shotsOnGoal", "ST", "3")]
    );
    const stats = parseMatchStats(summary, HOME_ESPN_ID)!;
    expect(stats.home.shotsOnTarget).toBe(5);
    expect(stats.away.shotsOnTarget).toBe(3);
  });

  it("returns null for unknown stat name", () => {
    const summary = makeSummaryWithStats(
      [stat("unknownStat", "UNK", "7")],
      []
    );
    const stats = parseMatchStats(summary, HOME_ESPN_ID)!;
    expect(stats.home.shots).toBeNull();
  });

  it("uses homeAway field to identify teams when homeEspnId not provided", () => {
    const summary = makeSummaryWithStats(
      [stat("totalShots", "SH", "10")],
      [stat("totalShots", "SH", "6")]
    );
    const stats = parseMatchStats(summary, null)!;
    expect(stats.home.shots).toBe(10);
    expect(stats.away.shots).toBe(6);
  });
});

// ─── parseMatchLineup ─────────────────────────────────────────────────────────

function makeRosterEntry(overrides: {
  id?: string;
  displayName?: string;
  jersey?: string;
  posAbbr?: string;
  starter?: boolean;
}) {
  return {
    athlete: {
      id: overrides.id ?? "1",
      displayName: overrides.displayName ?? "Player",
      jersey: overrides.jersey ?? "10",
      position: { abbreviation: overrides.posAbbr ?? "MF" },
    },
    starter: overrides.starter ?? true,
  };
}

function makeSummaryWithRosters(homeRoster: object[], awayRoster: object[]) {
  return {
    rosters: [
      { homeAway: "home", team: { id: HOME_ESPN_ID }, formation: "4-3-3", roster: homeRoster },
      { homeAway: "away", team: { id: AWAY_ESPN_ID }, formation: "4-4-2", roster: awayRoster },
    ],
  };
}

describe("parseMatchLineup", () => {
  it("returns null when rosters missing or too short", () => {
    expect(parseMatchLineup({}, HOME_ESPN_ID)).toBeNull();
    expect(parseMatchLineup({ rosters: [] }, HOME_ESPN_ID)).toBeNull();
  });

  it("returns null when rosters have empty roster arrays", () => {
    const summary = { rosters: [
      { homeAway: "home", roster: [] },
      { homeAway: "away", roster: [] },
    ] };
    expect(parseMatchLineup(summary, HOME_ESPN_ID)).toBeNull();
  });

  it("parses home and away rosters", () => {
    const summary = makeSummaryWithRosters(
      [makeRosterEntry({ id: "1", displayName: "Neuer", posAbbr: "GK", jersey: "1" })],
      [makeRosterEntry({ id: "2", displayName: "Lloris", posAbbr: "GK", jersey: "1" })]
    );
    const lineup = parseMatchLineup(summary, HOME_ESPN_ID)!;
    expect(lineup.home[0]).toMatchObject({ name: "Neuer", position: "GK", jersey: "1" });
    expect(lineup.away[0]).toMatchObject({ name: "Lloris", position: "GK" });
  });

  it("includes formations", () => {
    const summary = makeSummaryWithRosters(
      [makeRosterEntry({})],
      [makeRosterEntry({})]
    );
    const lineup = parseMatchLineup(summary, HOME_ESPN_ID)!;
    expect(lineup.homeFormation).toBe("4-3-3");
    expect(lineup.awayFormation).toBe("4-4-2");
  });

  it("marks starter flag correctly", () => {
    const summary = makeSummaryWithRosters(
      [
        makeRosterEntry({ id: "1", starter: true }),
        makeRosterEntry({ id: "2", starter: false }),
      ],
      [makeRosterEntry({ id: "3" })]
    );
    const lineup = parseMatchLineup(summary, HOME_ESPN_ID)!;
    expect(lineup.home[0].starter).toBe(true);
    expect(lineup.home[1].starter).toBe(false);
  });
});

// ─── parseLivePlays ───────────────────────────────────────────────────────────

function makeCommentary(plays: object[]) {
  return { commentary: plays.map((p) => ({ play: p })) };
}

describe("parseLivePlays", () => {
  it("returns empty array when no data", () => {
    expect(parseLivePlays({}, HOME_ESPN_ID)).toEqual([]);
    expect(parseLivePlays(null, HOME_ESPN_ID)).toEqual([]);
  });

  it("parses basic play text and clock", () => {
    const data = makeCommentary([
      { id: "1", clock: { displayValue: "12'" }, text: "Shot on target", scoringPlay: false },
    ]);
    const plays = parseLivePlays(data, HOME_ESPN_ID);
    expect(plays[0]).toMatchObject({ id: "1", clock: "12'", text: "Shot on target", scoringPlay: false });
  });

  it("marks scoring plays", () => {
    const data = makeCommentary([
      { id: "2", text: "GOAL!", scoringPlay: true, team: { id: HOME_ESPN_ID } },
    ]);
    const plays = parseLivePlays(data, HOME_ESPN_ID);
    expect(plays[0].scoringPlay).toBe(true);
  });

  it("assigns side=home when team id matches homeEspnId", () => {
    const data = makeCommentary([
      { id: "3", text: "Foul", team: { id: HOME_ESPN_ID } },
    ]);
    expect(parseLivePlays(data, HOME_ESPN_ID)[0].side).toBe("home");
  });

  it("assigns side=away when team id differs", () => {
    const data = makeCommentary([
      { id: "4", text: "Foul", team: { id: AWAY_ESPN_ID } },
    ]);
    expect(parseLivePlays(data, HOME_ESPN_ID)[0].side).toBe("away");
  });

  it("assigns side=undefined when no team id present", () => {
    const data = makeCommentary([{ id: "5", text: "Kickoff" }]);
    expect(parseLivePlays(data, HOME_ESPN_ID)[0].side).toBeUndefined();
  });

  it("caps output at 20 plays", () => {
    const plays = Array.from({ length: 30 }, (_, i) => ({ id: String(i), text: `Play ${i}` }));
    const data = makeCommentary(plays);
    expect(parseLivePlays(data, HOME_ESPN_ID)).toHaveLength(20);
  });

  it("falls back to plays array when commentary missing", () => {
    const data = {
      plays: [{ id: "10", text: "Fallback play", scoringPlay: false }],
    };
    const result = parseLivePlays(data, HOME_ESPN_ID);
    expect(result[0].text).toBe("Fallback play");
  });
});

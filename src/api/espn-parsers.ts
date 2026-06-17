import { ESPN_CDN_URL } from "../constants";
import type { MatchEvent, EventKind, MatchStats, TeamStats, MatchLineup, LineupPlayer, LivePlay } from "../types";

// ─── Raw ESPN shapes ──────────────────────────────────────────────────────────

export type RawDetail = {
  scoringPlay?: boolean;
  ownGoal?: boolean;
  yellowCard?: boolean;
  redCard?: boolean;
  penaltyKick?: boolean;
  clock?: { displayValue?: string };
  team?: { id?: string };
  athletesInvolved?: Array<{ displayName?: string; id?: string }>;
  assistsInvolved?: Array<{ displayName?: string }>;
};

export type RawComp = {
  id?: string;
  competitors?: Array<{ homeAway?: string; team?: { id?: string } }>;
  details?: RawDetail[];
};

export type RawStat = { name?: string; abbreviation?: string; displayValue?: string };
export type RawBoxscoreTeam = { homeAway?: string; team?: { id?: string }; statistics?: RawStat[] };
export type RawBoxscore = { teams?: RawBoxscoreTeam[] };

export type RawRosterAthlete = {
  athlete?: {
    id?: string;
    displayName?: string;
    fullName?: string;
    jersey?: string;
    position?: { name?: string; abbreviation?: string; displayName?: string };
    headshot?: { href?: string };
  };
  starter?: boolean;
  position?: { name?: string; abbreviation?: string; displayName?: string };
  jersey?: string;
};

export type RawRosterTeam = {
  homeAway?: string;
  team?: { id?: string };
  formation?: string;
  roster?: RawRosterAthlete[];
};

export type RawPlay = {
  id?: string | number;
  clock?: { displayValue?: string };
  text?: string;
  shortText?: string;
  scoringPlay?: boolean;
  team?: { id?: string };
};

// ─── Competition helper ───────────────────────────────────────────────────────

export function getCompetitionFromDetail(data: unknown): RawComp | undefined {
  return (data as { competitions?: RawComp[] })?.competitions?.[0];
}

function getHomeId(comp: RawComp | undefined, homeEspnId: string | null | undefined) {
  return comp?.competitors?.find((c) => c.homeAway === "home")?.team?.id ?? homeEspnId ?? undefined;
}

// ─── Event parsing ────────────────────────────────────────────────────────────

export function parseMatchEvents(
  data: unknown,
  homeEspnId: string | null | undefined
): MatchEvent[] {
  const comp = getCompetitionFromDetail(data);
  if (!comp) return [];
  const homeId = getHomeId(comp, homeEspnId);
  const events: MatchEvent[] = [];
  for (const d of comp.details ?? []) {
    let kind: EventKind;
    if (d.scoringPlay) {
      kind = d.ownGoal ? "ownGoal" : d.penaltyKick ? "penalty" : "goal";
    } else if (d.yellowCard && d.redCard) {
      kind = "yellowRedCard";
    } else if (d.redCard) {
      kind = "redCard";
    } else if (d.yellowCard) {
      kind = "yellowCard";
    } else {
      continue;
    }
    events.push({
      minute: d.clock?.displayValue ?? "",
      kind,
      player: d.athletesInvolved?.[0]?.displayName ?? "?",
      playerId: d.athletesInvolved?.[0]?.id,
      assist: d.assistsInvolved?.[0]?.displayName,
      side: d.team?.id === homeId ? "home" : "away",
    });
  }
  return events;
}

// ─── Stats parsing ────────────────────────────────────────────────────────────

function parseNumber(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace("%", ""));
  return isNaN(n) ? null : n;
}

function parseTeamStats(stats: RawStat[] | undefined): TeamStats {
  const get = (...names: string[]): string | undefined => {
    for (const s of stats ?? []) {
      const n = (s.name ?? "").toLowerCase();
      const a = (s.abbreviation ?? "").toLowerCase();
      if (names.some((target) => n === target.toLowerCase() || a === target.toLowerCase())) {
        return s.displayValue;
      }
    }
    return undefined;
  };
  return {
    possession: parseNumber(get("possessionPct", "possession", "POS")),
    shots: parseNumber(get("totalShots", "shots", "SH")),
    shotsOnTarget: parseNumber(get("shotsOnTarget", "shotsOnGoal", "ST", "SOT")),
    corners: parseNumber(get("wonCorners", "corners", "C", "CK")),
    fouls: parseNumber(get("foulsCommitted", "fouls", "F", "FC")),
    yellowCards: parseNumber(get("yellowCards", "YC")),
    redCards: parseNumber(get("redCards", "RC")),
    offsides: parseNumber(get("offsides", "O", "OFF")),
  };
}

export function parseMatchStats(
  summary: unknown,
  homeEspnId: string | null | undefined
): MatchStats | null {
  const bx = (summary as { boxscore?: RawBoxscore })?.boxscore;
  if (!bx?.teams || bx.teams.length < 2) return null;
  const home = bx.teams.find(
    (t) => t.homeAway === "home" || (homeEspnId && t.team?.id === homeEspnId)
  );
  const away = bx.teams.find(
    (t) => t.homeAway === "away" || (homeEspnId && t.team?.id !== homeEspnId)
  );
  if (!home || !away) return null;
  return { home: parseTeamStats(home.statistics), away: parseTeamStats(away.statistics) };
}

// ─── Lineup parsing ───────────────────────────────────────────────────────────

function parseLineupPlayer(entry: RawRosterAthlete): LineupPlayer {
  const a = entry.athlete ?? {};
  const pos = entry.position ?? a.position;
  const jersey = entry.jersey ?? a.jersey ?? null;
  return {
    id: String(a.id ?? ""),
    name: String(a.displayName ?? a.fullName ?? "?"),
    jersey: jersey != null ? String(jersey) : null,
    position: String(pos?.abbreviation ?? pos?.displayName ?? pos?.name ?? "?"),
    starter: !!entry.starter,
    headshot: a.headshot?.href ?? (a.id ? `${ESPN_CDN_URL}/${a.id}.png` : null),
  };
}

export function parseMatchLineup(
  summary: unknown,
  homeEspnId: string | null | undefined
): MatchLineup | null {
  const rosters = (summary as { rosters?: RawRosterTeam[] })?.rosters;
  if (!rosters || rosters.length < 2) return null;
  const home = rosters.find(
    (r) => r.homeAway === "home" || (homeEspnId && r.team?.id === homeEspnId)
  );
  const away = rosters.find(
    (r) => r.homeAway === "away" || (homeEspnId && r.team?.id !== homeEspnId)
  );
  if (!home?.roster?.length || !away?.roster?.length) return null;
  return {
    home: home.roster.map(parseLineupPlayer),
    away: away.roster.map(parseLineupPlayer),
    homeFormation: home.formation ?? null,
    awayFormation: away.formation ?? null,
  };
}

// ─── Live plays parsing ───────────────────────────────────────────────────────

export function parseLivePlays(
  commentary: unknown,
  homeEspnId: string | null | undefined
): LivePlay[] {
  const raw = commentary as { commentary?: Array<{ play?: RawPlay }>; plays?: RawPlay[] };
  const plays: RawPlay[] =
    (raw?.commentary?.map((c) => c.play).filter(Boolean) as RawPlay[]) ?? raw?.plays ?? [];
  return plays.slice(0, 20).map((p, i) => ({
    id: String(p.id ?? i),
    clock: p.clock?.displayValue ?? "",
    text: p.text ?? p.shortText ?? "",
    scoringPlay: !!p.scoringPlay,
    side: p.team?.id
      ? p.team.id === (homeEspnId ?? undefined)
        ? "home"
        : "away"
      : undefined,
  }));
}

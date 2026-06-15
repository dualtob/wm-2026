import { normalizeTeamName, getTeam } from "../teams";
import type { Match, TeamMeta, Standings, StandingRow, FixturesResult } from "../types";
import {
  OPENFOOTBALL_PRIMARY,
  OPENFOOTBALL_CDN,
  FIXTURES_CACHE_TTL,
  LS_FIXTURES_KEY,
  LS_FIXTURES_AT_KEY,
} from "../constants";
import { lsGet, lsSet } from "../utils/storage";

type RawMatch = {
  round?: string;
  date?: string;
  time?: string;
  team1?: string | { name?: string };
  team2?: string | { name?: string };
  score?: { ft?: [number, number] };
  group?: string;
  ground?: string;
  venue?: string;
};

type RawData = { matches?: RawMatch[] };

function parseOpenFootball(data: RawData): Match[] {
  const rawMatches = data?.matches;
  if (!Array.isArray(rawMatches)) return [];

  return rawMatches.map((m, i) => {
    const team1Name = normalizeTeamName(
      typeof m.team1 === "string" ? m.team1 : m.team1?.name ?? ""
    );
    const team2Name = normalizeTeamName(
      typeof m.team2 === "string" ? m.team2 : m.team2?.name ?? ""
    );
    const team1Data = getTeam(team1Name);
    const team2Data = getTeam(team2Name);

    const kickoff = m.date ? parseKickoff(m.date, m.time ?? "00:00") : null;

    let score: Match["score"] = null;
    let played = false;
    if (m.score) {
      const ft = m.score.ft;
      if (Array.isArray(ft) && ft.length === 2) {
        score = { home: ft[0], away: ft[1] };
        played = true;
      }
    }

    const isPlaceholder =
      !team1Name ||
      !team2Name ||
      team1Name.startsWith("?") ||
      team2Name.startsWith("?") ||
      !getTeam(team1Name) ||
      !getTeam(team2Name);

    const roundName = m.round ?? "";
    const matchdayMatch = roundName.match(/\d+/);
    const matchday = matchdayMatch ? parseInt(matchdayMatch[0]) : null;

    const team1: TeamMeta = {
      name: team1Name,
      abbr: team1Data?.abbr ?? team1Name.slice(0, 3).toUpperCase(),
      espnId: team1Data?.espnId ?? null,
      color: team1Data?.color ?? "888888",
    };
    const team2: TeamMeta = {
      name: team2Name,
      abbr: team2Data?.abbr ?? team2Name.slice(0, 3).toUpperCase(),
      espnId: team2Data?.espnId ?? null,
      color: team2Data?.color ?? "888888",
    };

    return {
      id: `of-${i + 1}`,
      kickoff,
      group: m.group ?? null,
      stage: roundName,
      matchday,
      venue: m.ground ?? m.venue ?? null,
      city: null,
      team1,
      team2,
      score,
      played,
      isPlaceholder,
      espnId: null,
      liveStatus: null,
      liveMinute: null,
    };
  });
}

function parseKickoff(dateStr: string, timeStr: string): Date | null {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const m = (timeStr || "00:00").match(/^(\d{1,2}):(\d{2})(?:\s*UTC([+-]\d+))?/);
    if (!m) return null;
    const hours = parseInt(m[1]);
    const mins = parseInt(m[2]);
    const offsetHours = m[3] ? parseInt(m[3]) : 0;
    return new Date(Date.UTC(year, month - 1, day, hours - offsetHours, mins));
  } catch {
    return null;
  }
}

async function fetchJSON(url: string): Promise<RawData> {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}_=${Date.now()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<RawData>;
}

type EspnCompetitor = {
  homeAway: string;
  score?: string | number;
  team?: { displayName?: string; name?: string };
};

type EspnEvent = {
  id?: string;
  status?: { type?: { name?: string }; displayClock?: string; period?: number };
  competitions?: Array<{
    competitors?: EspnCompetitor[];
  }>;
};

export function mergeEspnScores(matches: Match[], espnEvents: unknown[]): Match[] {
  if (!espnEvents?.length) return matches;

  type EspnEntry = {
    homeScore: number;
    awayScore: number;
    isLive: boolean;
    isFinal: boolean;
    isPenalties: boolean;
    liveMinute: string | null;
    liveStatus: string;
    espnEventId: string;
  };

  const byTeamPair: Record<string, EspnEntry> = {};

  for (const evt of espnEvents) {
    const e = evt as EspnEvent;
    const comps = e.competitions?.[0];
    if (!comps) continue;
    const competitors = comps.competitors ?? [];
    if (competitors.length < 2) continue;

    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeName = normalizeTeamName(home.team?.displayName ?? home.team?.name ?? "");
    const awayName = normalizeTeamName(away.team?.displayName ?? away.team?.name ?? "");
    const key = [homeName, awayName].sort().join("|");

    const statusName = e.status?.type?.name ?? "";
    const displayClock = e.status?.displayClock ?? "";

    byTeamPair[key] = {
      homeScore: parseInt(String(home.score)) || 0,
      awayScore: parseInt(String(away.score)) || 0,
      isLive: statusName === "STATUS_IN_PROGRESS",
      isFinal: statusName === "STATUS_FINAL" || statusName === "STATUS_FULL_TIME",
      isPenalties: statusName.includes("PENALTY"),
      liveMinute: displayClock || null,
      liveStatus: statusName,
      espnEventId: String(e.id ?? ""),
    };
  }

  return matches.map((m) => {
    const key = [m.team1.name, m.team2.name].sort().join("|");
    const espn = byTeamPair[key];
    if (!espn) return m;
    return {
      ...m,
      score: { home: espn.homeScore, away: espn.awayScore },
      played: espn.isFinal,
      isLive: espn.isLive,
      isPenalties: espn.isPenalties,
      liveMinute: espn.liveMinute,
      liveStatus: espn.liveStatus,
      espnId: espn.espnEventId,
    };
  });
}

export async function fetchFixtures(): Promise<FixturesResult> {
  const cachedData = lsGet(LS_FIXTURES_KEY);
  const cachedAt = lsGet(LS_FIXTURES_AT_KEY);
  const cacheAge = cachedAt ? Date.now() - parseInt(cachedAt) : Infinity;

  if (cachedData && cacheAge < FIXTURES_CACHE_TTL) {
    try {
      const data = JSON.parse(cachedData) as RawData;
      return { matches: parseOpenFootball(data), fromCache: true };
    } catch {
      // invalid cache
    }
  }

  try {
    const data = await fetchJSON(OPENFOOTBALL_PRIMARY);
    lsSet(LS_FIXTURES_KEY, JSON.stringify(data));
    lsSet(LS_FIXTURES_AT_KEY, Date.now().toString());
    return { matches: parseOpenFootball(data), fromCache: false };
  } catch (primaryErr) {
    try {
      const data = await fetchJSON(OPENFOOTBALL_CDN);
      lsSet(LS_FIXTURES_KEY, JSON.stringify(data));
      lsSet(LS_FIXTURES_AT_KEY, Date.now().toString());
      return { matches: parseOpenFootball(data), fromCache: false };
    } catch {
      if (cachedData) {
        try {
          const data = JSON.parse(cachedData) as RawData;
          return { matches: parseOpenFootball(data), fromCache: true, stale: true };
        } catch {
          // ignore
        }
      }
      throw primaryErr;
    }
  }
}

export function computeStandings(matches: Match[]): Standings {
  const groups: Record<string, Record<string, StandingRow>> = {};

  for (const m of matches) {
    if (!m.group || m.isPlaceholder) continue;
    if (!groups[m.group]) groups[m.group] = {};
    const g = groups[m.group];

    const initTeam = (name: string) => {
      if (!g[name]) {
        g[name] = {
          team: name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDiff: 0,
          points: 0,
        };
      }
    };

    initTeam(m.team1.name);
    initTeam(m.team2.name);

    if (!m.played || m.score === null) continue;

    const { home, away } = m.score;
    const t1 = g[m.team1.name];
    const t2 = g[m.team2.name];

    t1.played++;
    t2.played++;
    t1.goalsFor += home;
    t1.goalsAgainst += away;
    t2.goalsFor += away;
    t2.goalsAgainst += home;

    if (home > away) {
      t1.won++;
      t1.points += 3;
      t2.lost++;
    } else if (home < away) {
      t2.won++;
      t2.points += 3;
      t1.lost++;
    } else {
      t1.drawn++;
      t2.drawn++;
      t1.points++;
      t2.points++;
    }

    t1.goalDiff = t1.goalsFor - t1.goalsAgainst;
    t2.goalDiff = t2.goalsFor - t2.goalsAgainst;
  }

  const result: Standings = {};
  for (const [groupName, teamsObj] of Object.entries(groups)) {
    result[groupName] = Object.values(teamsObj).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.localeCompare(b.team);
    });
  }

  return result;
}

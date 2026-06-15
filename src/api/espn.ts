import { TEAMS } from "../teams";
import type { RosterGroup, RosterPlayer, Leaders, Player } from "../types";
import {
  ESPN_SCOREBOARD_URL,
  ESPN_CORE_URL,
  ESPN_CDN_URL,
  LS_SCOREBOARD_KEY,
} from "../constants";

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota errors
  }
}

export async function fetchScoreboard(): Promise<unknown[]> {
  const url = `${ESPN_SCOREBOARD_URL}&_=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
    const data = (await res.json()) as { events?: unknown[] };
    const events = data?.events ?? [];
    lsSet(LS_SCOREBOARD_KEY, JSON.stringify(events));
    return events;
  } catch (err) {
    const cached = lsGet(LS_SCOREBOARD_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as unknown[];
      } catch {
        return [];
      }
    }
    console.warn("ESPN scoreboard fetch failed:", (err as Error).message);
    return [];
  }
}

export async function fetchTeamRoster(espnId: string): Promise<RosterGroup | null> {
  if (!espnId) return null;
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${espnId}/roster?_=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return parseRoster(data);
  } catch (err) {
    console.warn(`Roster fetch failed for espnId ${espnId}:`, (err as Error).message);
    return null;
  }
}

function parseRoster(data: unknown): RosterGroup {
  const raw = data as { athletes?: unknown[]; roster?: unknown[] };
  const athletes = raw?.athletes ?? raw?.roster ?? [];
  const grouped: RosterGroup = { G: [], D: [], M: [], F: [] };

  for (const player of athletes) {
    const p = ((player as { athlete?: Record<string, unknown> }).athlete ??
      player) as Record<string, unknown>;
    const posObj = p.position as
      | { abbreviation?: string; name?: string; displayName?: string }
      | undefined;
    const pos = posObj?.abbreviation ?? posObj?.name ?? "?";
    const posKey =
      pos.startsWith("G")
        ? "G"
        : pos.startsWith("D")
        ? "D"
        : pos.startsWith("M")
        ? "M"
        : pos.startsWith("F") || pos.startsWith("A")
        ? "F"
        : null;

    const headshotObj = p.headshot as { href?: string } | undefined;
    const entry: RosterPlayer = {
      id: String(p.id ?? p.uid ?? ""),
      name: String(p.displayName ?? p.fullName ?? p.name ?? "Unknown"),
      position: String(posObj?.displayName ?? pos),
      jersey: p.jersey != null ? String(p.jersey) : p.displayNumber != null ? String(p.displayNumber) : null,
      age: p.age != null ? Number(p.age) : null,
      headshot: headshotObj?.href ?? (p.id ? `${ESPN_CDN_URL}/${p.id}.png` : null),
    };

    if (posKey) {
      grouped[posKey].push(entry);
    } else {
      grouped.F.push(entry);
    }
  }

  for (const key of Object.keys(grouped) as (keyof RosterGroup)[]) {
    grouped[key].sort((a, b) => {
      const na = parseInt(a.jersey ?? "99") || 99;
      const nb = parseInt(b.jersey ?? "99") || 99;
      return na - nb;
    });
  }

  return grouped;
}

const espnIdMap: Record<string, string> = Object.fromEntries(
  Object.entries(TEAMS).map(([name, t]) => [t.espnId, name])
);

function espnIdToTeamName(espnId: string): string {
  return espnIdMap[espnId] ?? "";
}

function extractId(ref: string | undefined): string | null {
  return ref?.match(/\/(\d+)(?:\?|$)/)?.[1] ?? null;
}

const athleteCache: Record<string, { name: string; id: string }> = {};

async function fetchAthleteName(
  ref: string | undefined
): Promise<{ name: string; id: string } | null> {
  if (!ref) return null;
  const id = extractId(ref);
  if (!id) return null;
  if (athleteCache[id]) return athleteCache[id];
  try {
    const url = `${ESPN_CORE_URL}/seasons/2026/athletes/${id}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { displayName?: string; fullName?: string };
    const name = data.displayName ?? data.fullName ?? null;
    if (!name) return null;
    athleteCache[id] = { name, id };
    return athleteCache[id];
  } catch {
    return null;
  }
}

type LeaderEntry = {
  value: number;
  athlete?: { $ref?: string };
  team?: { $ref?: string };
};

type LeaderCategory = {
  name: string;
  leaders?: LeaderEntry[];
};

export async function fetchLeaders(): Promise<Leaders> {
  const url = `${ESPN_CORE_URL}/seasons/2026/types/1/leaders`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { categories?: LeaderCategory[] };

    const goalsCategory = data.categories?.find((c) => c.name === "goalsLeaders");
    const assistsCategory = data.categories?.find((c) => c.name === "assistsLeaders");

    const parseCategory = async (cat: LeaderCategory | undefined): Promise<Player[]> => {
      if (!cat?.leaders?.length) return [];
      const entries = cat.leaders.filter((e) => e.value > 0).slice(0, 20);
      const athletes = await Promise.all(
        entries.map((e) => fetchAthleteName(e.athlete?.["$ref"]))
      );
      return entries
        .map((e, i) => {
          const athlete = athletes[i];
          if (!athlete?.name) return null;
          const teamId = extractId(e.team?.["$ref"]);
          return {
            id: athlete.id,
            name: athlete.name,
            team: espnIdToTeamName(teamId ?? ""),
            value: e.value,
            headshot: `${ESPN_CDN_URL}/${athlete.id}.png`,
          };
        })
        .filter((p): p is Player => p !== null);
    };

    const [scorers, assists] = await Promise.all([
      parseCategory(goalsCategory),
      parseCategory(assistsCategory),
    ]);

    return { scorers, assists };
  } catch (err) {
    console.warn("Leaders fetch failed:", (err as Error).message);
    const events = await fetchScoreboard();
    return aggregateFromScoreboard(events);
  }
}

type ScoreboardEvent = {
  competitions?: Array<{
    status?: { type?: { completed?: boolean } };
    details?: Array<{
      scoringPlay?: boolean;
      ownGoal?: boolean;
      athletesInvolved?: Array<{ id: string; displayName?: string; fullName?: string }>;
      team?: { id?: string };
    }>;
  }>;
};

function aggregateFromScoreboard(events: unknown[]): Leaders {
  const goalMap: Record<string, Player> = {};
  for (const evt of events) {
    const e = evt as ScoreboardEvent;
    const comp = e.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;
    for (const detail of comp.details ?? []) {
      if (!detail.scoringPlay || detail.ownGoal) continue;
      const scorer = detail.athletesInvolved?.[0];
      if (!scorer) continue;
      const espnTeamId = String(detail.team?.id ?? "");
      if (!goalMap[scorer.id]) {
        goalMap[scorer.id] = {
          id: scorer.id,
          name: scorer.displayName ?? scorer.fullName ?? "",
          team: espnIdToTeamName(espnTeamId),
          value: 0,
          headshot: `${ESPN_CDN_URL}/${scorer.id}.png`,
        };
      }
      goalMap[scorer.id].value++;
    }
  }
  const scorers = Object.values(goalMap).sort((a, b) => b.value - a.value).slice(0, 20);
  return { scorers, assists: [] };
}

export async function fetchMatchDetail(espnEventId: string): Promise<unknown | null> {
  if (!espnEventId) return null;
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard/${espnEventId}?_=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}

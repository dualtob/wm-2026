// Fixture data from OpenFootball + merge with ESPN live scores
import { normalizeTeamName, getTeam } from "../teams.js";

const PRIMARY_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
const CDN_URL =
  "https://cdn.jsdelivr.net/gh/openfootball/worldcup.json@master/2026/worldcup.json";

const LS_DATA_KEY = "wc2026:data";
const LS_FETCHED_KEY = "wc2026:fetchedAt";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota errors
  }
}

// Parse OpenFootball JSON into normalized match objects.
// Actual format: { matches: [{ round, date, time, team1, team2, score, group, ground }] }
// team1/team2 are strings. time is like "13:00 UTC-6".
function parseOpenFootball(data) {
  const rawMatches = data?.matches;
  if (!Array.isArray(rawMatches)) return [];

  return rawMatches.map((m, i) => {
    const team1Name = normalizeTeamName(
      typeof m.team1 === "string" ? m.team1 : m.team1?.name || ""
    );
    const team2Name = normalizeTeamName(
      typeof m.team2 === "string" ? m.team2 : m.team2?.name || ""
    );
    const team1Data = getTeam(team1Name) || {};
    const team2Data = getTeam(team2Name) || {};

    // Parse date + time including UTC offset ("13:00 UTC-6")
    let kickoff = null;
    if (m.date) {
      kickoff = parseKickoff(m.date, m.time || "00:00");
    }

    // Score
    let score = null;
    let played = false;
    if (m.score) {
      const ft = m.score.ft;
      if (Array.isArray(ft) && ft.length === 2) {
        score = { home: ft[0], away: ft[1] };
        played = true;
      }
    }

    const isPlaceholder =
      !team1Name || !team2Name ||
      team1Name.startsWith("?") || team2Name.startsWith("?") ||
      !getTeam(team1Name) || !getTeam(team2Name);

    const roundName = m.round || "";
    const matchdayMatch = roundName.match(/\d+/);
    const matchday = matchdayMatch ? parseInt(matchdayMatch[0]) : null;

    return {
      id: `of-${i + 1}`,
      kickoff,
      group: m.group || null,
      stage: roundName,
      matchday,
      venue: m.ground || m.venue || null,
      city: null,
      team1: {
        name: team1Name,
        abbr: team1Data.abbr || team1Name.slice(0, 3).toUpperCase(),
        espnId: team1Data.espnId || null,
        color: team1Data.color || "888888",
      },
      team2: {
        name: team2Name,
        abbr: team2Data.abbr || team2Name.slice(0, 3).toUpperCase(),
        espnId: team2Data.espnId || null,
        color: team2Data.color || "888888",
      },
      score,
      played,
      isPlaceholder,
      espnId: null,
      liveStatus: null,
      liveMinute: null,
    };
  });
}

// Parse "2026-06-11" + "13:00 UTC-6" → UTC Date
function parseKickoff(dateStr, timeStr) {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    // Extract HH:MM and optional UTC offset (e.g. "13:00 UTC-6" or "21:00")
    const m = (timeStr || "00:00").match(/^(\d{1,2}):(\d{2})(?:\s*UTC([+-]\d+))?/);
    if (!m) return null;
    const hours = parseInt(m[1]);
    const mins = parseInt(m[2]);
    const offsetHours = m[3] ? parseInt(m[3]) : 0;
    // UTC = local - offset
    return new Date(Date.UTC(year, month - 1, day, hours - offsetHours, mins));
  } catch {
    return null;
  }
}

// Fetch with cache-busting
async function fetchJSON(url) {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}_=${Date.now()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Merge ESPN scoreboard data into matches
export function mergeEspnScores(matches, espnEvents) {
  if (!espnEvents?.length) return matches;

  // Build lookup by ESPN event ID (we stored it during merge) and by team names
  const byTeamPair = {};
  for (const evt of espnEvents) {
    const comps = evt.competitions?.[0];
    if (!comps) continue;
    const competitors = comps.competitors || [];
    if (competitors.length < 2) continue;

    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeName = normalizeTeamName(home.team?.displayName || home.team?.name || "");
    const awayName = normalizeTeamName(away.team?.displayName || away.team?.name || "");
    const key = [homeName, awayName].sort().join("|");

    const status = evt.status?.type;
    const statusName = status?.name || "";
    const displayClock = evt.status?.displayClock || "";
    const period = evt.status?.period || 0;

    byTeamPair[key] = {
      homeScore: parseInt(home.score) || 0,
      awayScore: parseInt(away.score) || 0,
      isLive: statusName === "STATUS_IN_PROGRESS",
      isFinal: statusName === "STATUS_FINAL" || statusName === "STATUS_FULL_TIME",
      isPenalties: statusName?.includes("PENALTY") || false,
      liveMinute: displayClock || null,
      liveStatus: statusName,
      espnEventId: evt.id,
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

// Main fetch function
export async function fetchFixtures() {
  // Try cached data first to return quickly, then refresh
  const cachedData = lsGet(LS_DATA_KEY);
  const cachedAt = lsGet(LS_FETCHED_KEY);
  const cacheAge = cachedAt ? Date.now() - parseInt(cachedAt) : Infinity;

  // If fresh cache, use it
  if (cachedData && cacheAge < CACHE_TTL) {
    try {
      const data = JSON.parse(cachedData);
      const matches = parseOpenFootball(data);
      return { matches, fromCache: true };
    } catch {
      // invalid cache, continue to fetch
    }
  }

  // Try primary URL
  try {
    const data = await fetchJSON(PRIMARY_URL);
    lsSet(LS_DATA_KEY, JSON.stringify(data));
    lsSet(LS_FETCHED_KEY, Date.now().toString());
    const matches = parseOpenFootball(data);
    return { matches, fromCache: false };
  } catch (primaryErr) {
    // Try CDN fallback
    try {
      const data = await fetchJSON(CDN_URL);
      lsSet(LS_DATA_KEY, JSON.stringify(data));
      lsSet(LS_FETCHED_KEY, Date.now().toString());
      const matches = parseOpenFootball(data);
      return { matches, fromCache: false };
    } catch {
      // Try stale cache
      if (cachedData) {
        try {
          const data = JSON.parse(cachedData);
          const matches = parseOpenFootball(data);
          return { matches, fromCache: true, stale: true };
        } catch {
          // ignore
        }
      }
      throw primaryErr;
    }
  }
}

// Compute group standings from matches
export function computeStandings(matches) {
  const groups = {};

  for (const m of matches) {
    if (!m.group || m.isPlaceholder) continue;

    if (!groups[m.group]) groups[m.group] = {};
    const g = groups[m.group];

    const initTeam = (name) => {
      if (!g[name]) {
        g[name] = { team: name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };
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

  // Sort each group
  const result = {};
  for (const [groupName, teamsObj] of Object.entries(groups)) {
    const sorted = Object.values(teamsObj).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.localeCompare(b.team);
    });
    result[groupName] = sorted;
  }

  return result;
}

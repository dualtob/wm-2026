// ESPN API calls with localStorage caching
import { normalizeTeamName } from "../teams.js";

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719";
const CORE_API_URL =
  "https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world";

const LS_SCOREBOARD_KEY = "wc2026:espn:scoreboard";

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
    // ignore
  }
}

// Fetch ESPN scoreboard (always bust cache for live data)
export async function fetchScoreboard() {
  const url = `${SCOREBOARD_URL}&_=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
    const data = await res.json();
    const events = data?.events || [];
    lsSet(LS_SCOREBOARD_KEY, JSON.stringify(events));
    return events;
  } catch (err) {
    // Fall back to cached scoreboard
    const cached = lsGet(LS_SCOREBOARD_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return [];
      }
    }
    console.warn("ESPN scoreboard fetch failed:", err.message);
    return [];
  }
}

// Fetch team roster from ESPN
export async function fetchTeamRoster(espnId) {
  if (!espnId) return null;
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${espnId}/roster?_=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return parseRoster(data);
  } catch (err) {
    console.warn(`Roster fetch failed for espnId ${espnId}:`, err.message);
    return null;
  }
}

function parseRoster(data) {
  const athletes = data?.athletes || data?.roster || [];
  const grouped = { G: [], D: [], M: [], F: [] };

  for (const player of athletes) {
    // ESPN can return different shapes
    const p = player.athlete || player;
    const pos = p.position?.abbreviation || p.position?.name || "?";
    const posKey = pos.startsWith("G") ? "G" : pos.startsWith("D") ? "D" : pos.startsWith("M") ? "M" : pos.startsWith("F") || pos.startsWith("A") ? "F" : null;

    const entry = {
      id: p.id || p.uid,
      name: p.displayName || p.fullName || p.name || "Unknown",
      position: p.position?.displayName || pos,
      jersey: p.jersey || p.displayNumber || null,
      age: p.age || null,
      headshot: p.headshot?.href || (p.id ? `https://a.espncdn.com/i/headshots/soccer/players/full/${p.id}.png` : null),
    };

    if (posKey && grouped[posKey]) {
      grouped[posKey].push(entry);
    } else {
      // Unknown position — put in closest guess
      grouped.F.push(entry);
    }
  }

  // Sort by jersey number within each group
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => {
      const na = parseInt(a.jersey) || 99;
      const nb = parseInt(b.jersey) || 99;
      return na - nb;
    });
  }

  return grouped;
}

// Map ESPN team ID → team name using the TEAMS constant
import { TEAMS } from "../teams.js";
const espnIdMap = Object.fromEntries(
  Object.entries(TEAMS).map(([name, t]) => [t.espnId, name])
);
function espnIdToTeamName(espnId) {
  return espnIdMap[String(espnId)] || "";
}

// Extract numeric ID from a Core API $ref URL like:
// http://sports.core.api.espn.com/.../athletes/282643?...
function extractId(ref) {
  return ref?.match(/\/(\d+)(?:\?|$)/)?.[1] || null;
}

// Cache athlete name fetches so we don't re-request the same player
const athleteCache = {};
async function fetchAthleteName(ref) {
  if (!ref) return null;
  const id = extractId(ref);
  if (!id) return null;
  if (athleteCache[id]) return athleteCache[id];
  try {
    const url = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/seasons/2026/athletes/${id}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const name = data.displayName || data.fullName || null;
    athleteCache[id] = { name, id };
    return athleteCache[id];
  } catch {
    return null;
  }
}

// Fetch top scorers + assists from ESPN Core API leaders endpoint.
// The site API /leaders returns 404; the Core API has the real data.
export async function fetchLeaders() {
  const url =
    "https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/seasons/2026/types/1/leaders";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const goalsCategory = data.categories?.find((c) => c.name === "goalsLeaders");
    const assistsCategory = data.categories?.find((c) => c.name === "assistsLeaders");

    const parseCategory = async (cat) => {
      if (!cat?.leaders?.length) return [];
      const entries = cat.leaders.filter((e) => e.value > 0).slice(0, 20);

      // Fetch all athlete names in parallel
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
            team: espnIdToTeamName(teamId),
            value: e.value,
            headshot: `https://a.espncdn.com/i/headshots/soccer/players/full/${athlete.id}.png`,
          };
        })
        .filter(Boolean);
    };

    const [scorers, assists] = await Promise.all([
      parseCategory(goalsCategory),
      parseCategory(assistsCategory),
    ]);

    return { scorers, assists };
  } catch (err) {
    console.warn("Leaders fetch failed:", err.message);
    // Fall back to aggregating from scoreboard (has goals but no assists)
    const events = await fetchScoreboard();
    return aggregateFromScoreboard(events);
  }
}

function aggregateFromScoreboard(events) {
  const goalMap = {};
  for (const evt of events) {
    const comp = evt.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;
    for (const detail of comp.details || []) {
      if (!detail.scoringPlay || detail.ownGoal) continue;
      const scorer = detail.athletesInvolved?.[0];
      if (!scorer) continue;
      const espnTeamId = String(detail.team?.id || "");
      if (!goalMap[scorer.id]) {
        goalMap[scorer.id] = {
          id: scorer.id,
          name: scorer.displayName || scorer.fullName || "",
          team: espnIdToTeamName(espnTeamId),
          value: 0,
          headshot: `https://a.espncdn.com/i/headshots/soccer/players/full/${scorer.id}.png`,
        };
      }
      goalMap[scorer.id].value++;
    }
  }
  const scorers = Object.values(goalMap).sort((a, b) => b.value - a.value).slice(0, 20);
  return { scorers, assists: [] };
}

// Fetch match details (scoreboard event detail)
export async function fetchMatchDetail(espnEventId) {
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

// Polymarket prediction market API
const GAMMA_BASE = "https://gamma-api.polymarket.com";
const LS_PREFIX = "wc2026:pm:";
const LS_TREND_PREFIX = "wc2026:pm:trend:";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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

// Normalize country names to Polymarket market slug format
export function normalizeForPolymarket(name) {
  if (!name) return "";
  const map = {
    "South Korea": "korea-republic",
    "Korea Republic": "korea-republic",
    "Ivory Coast": "cote-divoire",
    "Côte d'Ivoire": "cote-divoire",
    "DR Congo": "democratic-republic-of-congo",
    "Bosnia & Herzegovina": "bosnia-and-herzegovina",
    "Czech Republic": "czech-republic",
    "Saudi Arabia": "saudi-arabia",
    "Cape Verde": "cape-verde",
    "New Zealand": "new-zealand",
    "South Africa": "south-africa",
    USA: "united-states",
  };
  if (map[name]) return map[name];
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Market slug lookups for specific prediction types
const CHAMPION_SLUG = "2026-fifa-world-cup-winner";
const TOP_SCORER_SLUG = "2026-fifa-world-cup-top-scorer";

// Fetch markets by slug pattern
async function fetchMarkets(slug) {
  const cacheKey = `${LS_PREFIX}${slug}`;
  const cached = lsGet(cacheKey);
  if (cached) {
    try {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) return data;
    } catch {
      // ignore
    }
  }

  try {
    const url = `${GAMMA_BASE}/markets?slug=${encodeURIComponent(slug)}&active=true&closed=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lsSet(cacheKey, JSON.stringify({ data, ts: Date.now() }));
    return data;
  } catch (err) {
    console.warn(`Polymarket fetch failed for slug "${slug}":`, err.message);
    return null;
  }
}

// Search for markets by keyword
async function searchMarkets(query) {
  const cacheKey = `${LS_PREFIX}search:${query}`;
  const cached = lsGet(cacheKey);
  if (cached) {
    try {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) return data;
    } catch {
      // ignore
    }
  }

  try {
    const url = `${GAMMA_BASE}/markets?search=${encodeURIComponent(query)}&active=true&limit=50`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lsSet(cacheKey, JSON.stringify({ data, ts: Date.now() }));
    return data;
  } catch (err) {
    console.warn(`Polymarket search failed for "${query}":`, err.message);
    return null;
  }
}

// Parse token outcomes from a market
function parseOutcomes(market) {
  if (!market) return [];
  const tokens = market.tokens || market.outcomes || [];
  return tokens.map((t) => ({
    outcome: t.outcome || t.name || t.title || "",
    probability: parseFloat(t.price || t.probability || 0),
  })).filter((o) => o.outcome && !isNaN(o.probability))
    .sort((a, b) => b.probability - a.probability);
}

// Fetch champion odds
export async function fetchChampionOdds() {
  const data = await searchMarkets("2026 FIFA World Cup winner");
  if (!data) return null;

  const markets = Array.isArray(data) ? data : data.markets || [];
  const market = markets[0];
  if (!market) return null;

  const outcomes = parseOutcomes(market);
  return {
    market: market.question || market.title || "World Cup Winner",
    outcomes,
    url: market.url || null,
  };
}

// Fetch top scorer odds
export async function fetchTopScorerOdds() {
  const data = await searchMarkets("2026 FIFA World Cup top scorer");
  if (!data) return null;

  const markets = Array.isArray(data) ? data : data.markets || [];
  const market = markets[0];
  if (!market) return null;

  const outcomes = parseOutcomes(market);
  return {
    market: market.question || market.title || "Top Scorer",
    outcomes,
    url: market.url || null,
  };
}

// Fetch match win probability from Polymarket
export async function fetchMatchOdds(team1Name, team2Name) {
  const q = `${team1Name} vs ${team2Name} 2026 World Cup`;
  const data = await searchMarkets(q);
  if (!data) return null;

  const markets = Array.isArray(data) ? data : data.markets || [];
  if (!markets.length) return null;

  // Find the most relevant market
  const t1 = team1Name.toLowerCase();
  const t2 = team2Name.toLowerCase();
  const market = markets.find((m) => {
    const title = (m.question || m.title || "").toLowerCase();
    return title.includes(t1) && title.includes(t2);
  }) || markets[0];

  if (!market) return null;

  const outcomes = parseOutcomes(market);
  return {
    market: market.question || market.title || "",
    outcomes,
    url: market.url || null,
  };
}

// Fetch team-specific odds (advance from group, win group, reach final)
export async function fetchTeamOdds(teamName) {
  const slug = normalizeForPolymarket(teamName);
  const cacheKey = `${LS_TREND_PREFIX}${slug}`;
  const cached = lsGet(cacheKey);
  if (cached) {
    try {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) return data;
    } catch {
      // ignore
    }
  }

  const data = await searchMarkets(`${teamName} 2026 World Cup`);
  if (!data) return null;

  const markets = Array.isArray(data) ? data : data.markets || [];
  const result = {
    advance: null,
    winGroup: null,
    reachFinal: null,
    winChampion: null,
  };

  for (const m of markets) {
    const title = (m.question || m.title || "").toLowerCase();
    const outcomes = parseOutcomes(m);
    const yesOutcome = outcomes.find((o) => o.outcome.toLowerCase() === "yes");
    const prob = yesOutcome?.probability ?? outcomes[0]?.probability ?? null;

    if (title.includes("advance") || title.includes("round of 16") || title.includes("knockout")) {
      result.advance = prob;
    } else if (title.includes("win") && title.includes("group")) {
      result.winGroup = prob;
    } else if (title.includes("final")) {
      result.reachFinal = prob;
    } else if (title.includes("champion") || title.includes("winner")) {
      result.winChampion = prob;
    }
  }

  lsSet(cacheKey, JSON.stringify({ data: result, ts: Date.now() }));
  return result;
}

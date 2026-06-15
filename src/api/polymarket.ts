import type { MarketOdds, Outcome, TeamOdds } from "../types";
import { POLYMARKET_BASE, POLYMARKET_CACHE_TTL, LS_PM_PREFIX, LS_PM_TREND_PREFIX } from "../constants";

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
    // ignore
  }
}

export function normalizeForPolymarket(name: string): string {
  if (!name) return "";
  const map: Record<string, string> = {
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
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type RawMarket = {
  question?: string;
  title?: string;
  url?: string;
  tokens?: Array<{ outcome?: string; name?: string; title?: string; price?: string | number }>;
  outcomes?: Array<{ outcome?: string; name?: string; title?: string; probability?: string | number }>;
};

async function searchMarkets(query: string): Promise<RawMarket[] | null> {
  const cacheKey = `${LS_PM_PREFIX}search:${query}`;
  const cached = lsGet(cacheKey);
  if (cached) {
    try {
      const { data, ts } = JSON.parse(cached) as { data: RawMarket[]; ts: number };
      if (Date.now() - ts < POLYMARKET_CACHE_TTL) return data;
    } catch {
      // ignore
    }
  }

  try {
    const url = `${POLYMARKET_BASE}/markets?search=${encodeURIComponent(query)}&active=true&limit=50`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const data: RawMarket[] = Array.isArray(raw) ? raw : (raw as { markets?: RawMarket[] }).markets ?? [];
    lsSet(cacheKey, JSON.stringify({ data, ts: Date.now() }));
    return data;
  } catch (err) {
    console.warn(`Polymarket search failed for "${query}":`, (err as Error).message);
    return null;
  }
}

function parseOutcomes(market: RawMarket): Outcome[] {
  const tokens = market.tokens ?? market.outcomes ?? [];
  return (tokens as Array<Record<string, unknown>>)
    .map((t) => ({
      outcome: String(t.outcome ?? t.name ?? t.title ?? ""),
      probability: parseFloat(String(t.price ?? t.probability ?? 0)),
    }))
    .filter((o) => o.outcome && !isNaN(o.probability))
    .sort((a, b) => b.probability - a.probability);
}

export async function fetchChampionOdds(): Promise<MarketOdds | null> {
  const markets = await searchMarkets("2026 FIFA World Cup winner");
  if (!markets?.length) return null;
  const market = markets[0];
  return {
    market: market.question ?? market.title ?? "World Cup Winner",
    outcomes: parseOutcomes(market),
    url: market.url ?? null,
  };
}

export async function fetchTopScorerOdds(): Promise<MarketOdds | null> {
  const markets = await searchMarkets("2026 FIFA World Cup top scorer");
  if (!markets?.length) return null;
  const market = markets[0];
  return {
    market: market.question ?? market.title ?? "Top Scorer",
    outcomes: parseOutcomes(market),
    url: market.url ?? null,
  };
}

export async function fetchMatchOdds(
  team1Name: string,
  team2Name: string
): Promise<MarketOdds | null> {
  const markets = await searchMarkets(`${team1Name} vs ${team2Name} 2026 World Cup`);
  if (!markets?.length) return null;

  const t1 = team1Name.toLowerCase();
  const t2 = team2Name.toLowerCase();
  const market =
    markets.find((m) => {
      const title = (m.question ?? m.title ?? "").toLowerCase();
      return title.includes(t1) && title.includes(t2);
    }) ?? markets[0];

  if (!market) return null;
  return {
    market: market.question ?? market.title ?? "",
    outcomes: parseOutcomes(market),
    url: market.url ?? null,
  };
}

export async function fetchTeamOdds(teamName: string): Promise<TeamOdds | null> {
  const slug = normalizeForPolymarket(teamName);
  const cacheKey = `${LS_PM_TREND_PREFIX}${slug}`;
  const cached = lsGet(cacheKey);
  if (cached) {
    try {
      const { data, ts } = JSON.parse(cached) as { data: TeamOdds; ts: number };
      if (Date.now() - ts < POLYMARKET_CACHE_TTL) return data;
    } catch {
      // ignore
    }
  }

  const markets = await searchMarkets(`${teamName} 2026 World Cup`);
  if (!markets) return null;

  const result: TeamOdds = {
    advance: null,
    winGroup: null,
    reachFinal: null,
    winChampion: null,
  };

  for (const m of markets) {
    const title = (m.question ?? m.title ?? "").toLowerCase();
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

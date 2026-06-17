import { normalizeTeamName } from "../teams";
import { OPENFOOTBALL_PRIMARY, OPENFOOTBALL_CDN } from "../constants";
import type { LeagueConfig } from "../types";

export const WC2026: LeagueConfig = {
  espnSlug: "fifa.world",
  espnSeason: "2026",
  espnScoreboardDates: "20260611-20260719",
  fixtureUrls: { primary: OPENFOOTBALL_PRIMARY, cdn: OPENFOOTBALL_CDN },
  normalizeTeam: normalizeTeamName,
};

export const queryKeys = {
  fixtures: () => ["fixtures"] as const,
  scoreboard: () => ["scoreboard"] as const,
  leaders: () => ["leaders"] as const,
  championOdds: () => ["championOdds"] as const,
  matchDetail: (espnId: string | null | undefined) => ["matchDetail", espnId] as const,
  matchSummary: (espnId: string | null | undefined) => ["matchSummary", espnId] as const,
  liveCommentary: (espnId: string | null | undefined) => ["liveCommentary", espnId] as const,
  playerProfile: (playerId: string | null | undefined) => ["playerProfile", playerId] as const,
  roster: (espnId: string | null | undefined) => ["roster", espnId] as const,
  matchOdds: (team1: string, team2: string) => ["matchOdds", team1, team2] as const,
  teamOdds: (teamName: string) => ["teamOdds", teamName] as const,
};

export type Lang = "en" | "de" | "es";

export interface TeamMeta {
  name: string;
  abbr: string;
  espnId: string | null;
  color: string;
}

export interface Score {
  home: number;
  away: number;
}

export interface Match {
  id: string;
  kickoff: Date | null;
  group: string | null;
  stage: string;
  matchday: number | null;
  venue: string | null;
  city: string | null;
  team1: TeamMeta;
  team2: TeamMeta;
  score: Score | null;
  played: boolean;
  isLive?: boolean;
  isPenalties?: boolean;
  liveMinute?: string | null;
  liveStatus?: string | null;
  espnId?: string | null;
  isPlaceholder: boolean;
}

export interface StandingRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export type Standings = Record<string, StandingRow[]>;

export interface Player {
  id: string;
  name: string;
  team: string;
  value: number;
  headshot: string;
}

export interface Leaders {
  scorers: Player[];
  assists: Player[];
}

export interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  jersey: string | null;
  age: number | null;
  headshot: string | null;
}

export interface RosterGroup {
  G: RosterPlayer[];
  D: RosterPlayer[];
  M: RosterPlayer[];
  F: RosterPlayer[];
}

export interface Outcome {
  outcome: string;
  probability: number;
}

export interface MarketOdds {
  market: string;
  outcomes: Outcome[];
  url: string | null;
}

export interface TeamOdds {
  advance: number | null;
  winGroup: number | null;
  reachFinal: number | null;
  winChampion: number | null;
}

export interface FixturesResult {
  matches: Match[];
  fromCache: boolean;
  stale?: boolean;
}

// ─── Match events (Phase 1) ────────────────────────────────────────────────
export type EventKind =
  | "goal"
  | "ownGoal"
  | "penalty"
  | "yellowCard"
  | "redCard"
  | "yellowRedCard";

export interface MatchEvent {
  minute: string;
  kind: EventKind;
  player: string;
  playerId?: string;
  assist?: string;
  side: "home" | "away";
}

// ─── Match stats (Phase 2) ─────────────────────────────────────────────────
export interface TeamStats {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
  offsides: number | null;
}

export interface MatchStats {
  home: TeamStats;
  away: TeamStats;
}

// ─── Match lineup (Phase 3) ────────────────────────────────────────────────
export interface LineupPlayer {
  id: string;
  name: string;
  jersey: string | null;
  position: string;
  starter: boolean;
  headshot: string | null;
}

export interface MatchLineup {
  home: LineupPlayer[];
  away: LineupPlayer[];
  homeFormation: string | null;
  awayFormation: string | null;
}

// ─── Player profile (Phase 4) ──────────────────────────────────────────────
export interface PlayerProfile {
  id: string;
  name: string;
  team: string;
  teamEspnId: string;
  position: string;
  age: number | null;
  nationality: string | null;
  headshot: string | null;
  club: string | null;
}

// ─── Live plays (Phase 5) ──────────────────────────────────────────────────
export interface LivePlay {
  id: string;
  clock: string;
  text: string;
  scoringPlay: boolean;
  side?: "home" | "away";
}

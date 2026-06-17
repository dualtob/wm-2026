import { useState, useCallback, useRef } from "react";
import { lsGet, lsSet } from "../utils/storage";
import { useFocusTrap } from "../hooks/useFocusTrap";
import FlagIcon from "./FlagIcon";
import { useSettings } from "../contexts/SettingsContext";
import { useMatchGoals } from "../hooks/useMatchDetail";
import { useMatchSummary } from "../hooks/useMatchSummary";
import { useLivePlays } from "../hooks/useLivePlays";
import { t } from "../i18n";
import type {
  Match,
  MatchEvent,
  EventKind,
  MatchStats,
  TeamStats,
  MatchLineup,
  LineupPlayer,
  LivePlay,
} from "../types";
import { ESPN_CDN_URL } from "../constants";
import { TZ } from "../constants";

// ─── Raw ESPN detail shape ──────────────────────────────────────────────────

type RawDetail = {
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

type RawComp = {
  id?: string;
  competitors?: Array<{ homeAway?: string; team?: { id?: string } }>;
  details?: RawDetail[];
};

export function getCompetitionFromDetail(data: unknown): RawComp | undefined {
  return (data as { competitions?: RawComp[] })?.competitions?.[0];
}

function getHomeId(comp: RawComp | undefined, homeEspnId: string | null | undefined) {
  return comp?.competitors?.find((c) => c.homeAway === "home")?.team?.id ?? homeEspnId ?? undefined;
}

// ─── Event parsing ──────────────────────────────────────────────────────────

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

// ─── Event kind icon ────────────────────────────────────────────────────────

function EventIcon({ kind }: { kind: EventKind }) {
  if (kind === "goal" || kind === "ownGoal" || kind === "penalty") {
    return <span className="ev-icon ev-icon--ball" aria-hidden="true">⚽</span>;
  }
  return (
    <span className="ev-icon" aria-hidden="true">
      {(kind === "yellowCard" || kind === "yellowRedCard") && (
        <span className="ev-card ev-card--yellow" />
      )}
      {(kind === "redCard" || kind === "yellowRedCard") && (
        <span className="ev-card ev-card--red" />
      )}
    </span>
  );
}

// ─── Events tab (Phase 1) ───────────────────────────────────────────────────

export function EventsTab({
  match,
  onPlayerClick,
}: {
  match: Match;
  onPlayerClick?: (id: string, name: string, teamEspnId: string) => void;
}) {
  const { lang } = useSettings();
  const { data, isLoading } = useMatchGoals(match.espnId);
  if (isLoading)
    return (
      <div className="modal-tab-loading">
        <div className="spinner" />
      </div>
    );
  const events = parseMatchEvents(data, match.team1.espnId);
  if (!events.length)
    return <p className="modal-tab-empty">{t(lang, "noEvents")}</p>;

  const homeEspnId = match.team1.espnId ?? "";
  const awayEspnId = match.team2.espnId ?? "";

  return (
    <ul className="ev-timeline">
      {events.map((ev, i) => (
        <li key={i} className={`ev-item ev-item--${ev.side}`}>
          <span className="ev-item__min">{ev.minute}</span>
          <EventIcon kind={ev.kind} />
          <span className="ev-item__player">
            {ev.playerId && onPlayerClick ? (
              <button
                className="ev-player-btn"
                onClick={() =>
                  onPlayerClick(
                    ev.playerId!,
                    ev.player,
                    ev.side === "home" ? homeEspnId : awayEspnId
                  )
                }
              >
                {ev.player}
              </button>
            ) : (
              ev.player
            )}
            {ev.kind === "ownGoal" && <span className="ev-tag">OG</span>}
            {ev.kind === "penalty" && <span className="ev-tag">P</span>}
            {ev.assist && <span className="ev-assist"> · {ev.assist}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Overview tab ───────────────────────────────────────────────────────────

function OverviewTab({ match, locale }: { match: Match; locale: string }) {
  const { lang } = useSettings();
  return (
    <div className="match-modal__meta">
      {match.stage && (
        <div className="match-modal__meta-row">
          <span className="match-modal__meta-label">{t(lang, "detailStage")}</span>
          <span>{match.stage}</span>
        </div>
      )}
      {match.venue && (
        <div className="match-modal__meta-row">
          <span className="match-modal__meta-label">{t(lang, "detailVenue")}</span>
          <span>
            {match.venue}
            {match.city ? `, ${match.city}` : ""}
          </span>
        </div>
      )}
      {match.kickoff && (
        <div className="match-modal__meta-row">
          <span className="match-modal__meta-label">{t(lang, "detailDateTime")}</span>
          <span>
            {new Intl.DateTimeFormat(locale, {
              timeZone: TZ,
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(match.kickoff)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Stats parsing (Phase 2) ────────────────────────────────────────────────

type RawStat = { name?: string; abbreviation?: string; displayValue?: string };
type RawBoxscoreTeam = { homeAway?: string; team?: { id?: string }; statistics?: RawStat[] };
type RawBoxscore = { teams?: RawBoxscoreTeam[] };

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

// ─── Stats row ──────────────────────────────────────────────────────────────

function StatBar({
  label,
  home,
  away,
  isPercent = false,
}: {
  label: string;
  home: number | null;
  away: number | null;
  isPercent?: boolean;
}) {
  if (home === null && away === null) return null;
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a;
  const homePct = isPercent ? h : total === 0 ? 50 : (h / total) * 100;
  const awayPct = isPercent ? a : 100 - homePct;
  const fmt = (n: number | null) =>
    n === null ? "–" : isPercent ? `${Math.round(n)}%` : String(Math.round(n));
  return (
    <div className="stat-row">
      <div className="stat-row__head">
        <span className="stat-row__num">{fmt(home)}</span>
        <span className="stat-row__label">{label}</span>
        <span className="stat-row__num">{fmt(away)}</span>
      </div>
      <div className="stat-row__bars">
        <div className="stat-row__bar stat-row__bar--home" style={{ width: `${homePct}%` }} />
        <div className="stat-row__bar stat-row__bar--away" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  );
}

// ─── Stats tab (Phase 2) ────────────────────────────────────────────────────

export function StatsTab({ match }: { match: Match }) {
  const { lang } = useSettings();
  const { data, isLoading } = useMatchSummary(match.espnId);
  if (isLoading)
    return (
      <div className="modal-tab-loading">
        <div className="spinner" />
      </div>
    );
  const stats = parseMatchStats(data, match.team1.espnId);
  if (!stats) return <p className="modal-tab-empty">{t(lang, "noStats")}</p>;
  return (
    <div className="stats-tab">
      <StatBar label={t(lang, "statPoss")} home={stats.home.possession} away={stats.away.possession} isPercent />
      <StatBar label={t(lang, "statShots")} home={stats.home.shots} away={stats.away.shots} />
      <StatBar label={t(lang, "statShotsOn")} home={stats.home.shotsOnTarget} away={stats.away.shotsOnTarget} />
      <StatBar label={t(lang, "statCorners")} home={stats.home.corners} away={stats.away.corners} />
      <StatBar label={t(lang, "statFouls")} home={stats.home.fouls} away={stats.away.fouls} />
      <StatBar label={t(lang, "statOffsides")} home={stats.home.offsides} away={stats.away.offsides} />
    </div>
  );
}

// ─── Lineup parsing (Phase 3) ───────────────────────────────────────────────

type RawRosterAthlete = {
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

type RawRosterTeam = {
  homeAway?: string;
  team?: { id?: string };
  formation?: string;
  roster?: RawRosterAthlete[];
};

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

// ─── Pitch view ────────────────────────────────────────────────────────────

function parseFormationRows(formation: string | null, starters: LineupPlayer[]): LineupPlayer[][] {
  if (!formation || !starters.length) return [starters];
  const nums = formation.split("-").map(Number).filter((n) => !isNaN(n) && n > 0);
  // Prepend GK slot (always 1)
  const slots = [1, ...nums];
  const rows: LineupPlayer[][] = [];
  let idx = 0;
  for (const count of slots) {
    rows.push(starters.slice(idx, idx + count));
    idx += count;
  }
  return rows;
}

function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length <= 1) return name;
  return parts[parts.length - 1].length > 10
    ? parts[parts.length - 1].slice(0, 9) + "…"
    : parts[parts.length - 1];
}

function PitchHalf({
  players,
  formation,
  teamEspnId,
  reversed,
  onPlayerClick,
}: {
  players: LineupPlayer[];
  formation: string | null;
  teamEspnId: string;
  reversed: boolean;
  onPlayerClick?: (id: string, name: string, teamEspnId: string) => void;
}) {
  const rows = parseFormationRows(formation, players.filter((p) => p.starter));
  const displayRows = reversed ? [...rows].reverse() : rows;
  return (
    <div className={`pitch-half${reversed ? " pitch-half--away" : ""}`}>
      {displayRows.map((row, i) => (
        <div key={i} className="pitch-row">
          {row.map((p) => (
            <button
              key={p.id || p.name}
              className="pitch-player"
              onClick={() => p.id && onPlayerClick?.(p.id, p.name, teamEspnId)}
              disabled={!p.id || !onPlayerClick}
            >
              <span className="pitch-player__dot">{p.jersey ?? ""}</span>
              <span className="pitch-player__name">{shortName(p.name)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Lineup tab (Phase 3) ───────────────────────────────────────────────────

function PlayerRow({
  player,
  onClick,
}: {
  player: LineupPlayer;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="lp-jersey">{player.jersey ?? "–"}</span>
      <span className="lp-name">{player.name}</span>
      <span className="lp-pos">{player.position}</span>
    </>
  );
  if (onClick && player.id) {
    return (
      <button className="lp-row lp-row--btn" onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className="lp-row">{content}</div>;
}

function LineupColumn({
  title,
  players,
  formation,
  teamEspnId,
  onPlayerClick,
}: {
  title: string;
  players: LineupPlayer[];
  formation: string | null;
  teamEspnId: string;
  onPlayerClick?: (id: string, name: string, teamEspnId: string) => void;
}) {
  const starters = players.filter((p) => p.starter);
  const bench = players.filter((p) => !p.starter);
  const { lang } = useSettings();
  return (
    <div className="lp-col">
      <h4 className="lp-col__title">
        {title}
        {formation && <span className="lp-col__formation">{formation}</span>}
      </h4>
      {starters.length > 0 && (
        <>
          <p className="lp-group__label">{t(lang, "starters")}</p>
          {starters.map((p) => (
            <PlayerRow
              key={p.id || p.name}
              player={p}
              onClick={
                onPlayerClick && p.id
                  ? () => onPlayerClick(p.id, p.name, teamEspnId)
                  : undefined
              }
            />
          ))}
        </>
      )}
      {bench.length > 0 && (
        <>
          <p className="lp-group__label">{t(lang, "bench")}</p>
          {bench.map((p) => (
            <PlayerRow
              key={p.id || p.name}
              player={p}
              onClick={
                onPlayerClick && p.id
                  ? () => onPlayerClick(p.id, p.name, teamEspnId)
                  : undefined
              }
            />
          ))}
        </>
      )}
    </div>
  );
}

export function LineupTab({
  match,
  onPlayerClick,
}: {
  match: Match;
  onPlayerClick?: (id: string, name: string, teamEspnId: string) => void;
}) {
  const { lang } = useSettings();
  const { data, isLoading } = useMatchSummary(match.espnId);
  if (isLoading)
    return (
      <div className="modal-tab-loading">
        <div className="spinner" />
      </div>
    );
  const lineup = parseMatchLineup(data, match.team1.espnId);
  if (!lineup) return <p className="modal-tab-empty">{t(lang, "noLineup")}</p>;

  const hasBench =
    lineup.home.some((p) => !p.starter) || lineup.away.some((p) => !p.starter);

  return (
    <div className="lp-tab">
      {/* Pitch */}
      <div className="pitch">
        <div className="pitch__label pitch__label--home">
          {match.team1.name.length > 14 ? match.team1.abbr : match.team1.name}
          {lineup.homeFormation && <span className="pitch__formation">{lineup.homeFormation}</span>}
        </div>
        <PitchHalf
          players={lineup.home}
          formation={lineup.homeFormation}
          teamEspnId={match.team1.espnId ?? ""}
          reversed={false}
          onPlayerClick={onPlayerClick}
        />
        <div className="pitch__midline" />
        <PitchHalf
          players={lineup.away}
          formation={lineup.awayFormation}
          teamEspnId={match.team2.espnId ?? ""}
          reversed={true}
          onPlayerClick={onPlayerClick}
        />
        <div className="pitch__label pitch__label--away">
          {match.team2.name.length > 14 ? match.team2.abbr : match.team2.name}
          {lineup.awayFormation && <span className="pitch__formation">{lineup.awayFormation}</span>}
        </div>
      </div>

      {/* Bench */}
      {hasBench && (
        <div className="lp-bench">
          <LineupColumn
            title={match.team1.name}
            players={lineup.home.filter((p) => !p.starter).map((p) => ({ ...p, starter: false }))}
            formation={null}
            teamEspnId={match.team1.espnId ?? ""}
            onPlayerClick={onPlayerClick}
          />
          <LineupColumn
            title={match.team2.name}
            players={lineup.away.filter((p) => !p.starter).map((p) => ({ ...p, starter: false }))}
            formation={null}
            teamEspnId={match.team2.espnId ?? ""}
            onPlayerClick={onPlayerClick}
          />
        </div>
      )}
    </div>
  );
}

// ─── Live plays parsing (Phase 5) ───────────────────────────────────────────

type RawPlay = {
  id?: string | number;
  clock?: { displayValue?: string };
  text?: string;
  shortText?: string;
  scoringPlay?: boolean;
  team?: { id?: string };
};

export function parseLivePlays(
  commentary: unknown,
  homeEspnId: string | null | undefined
): LivePlay[] {
  // Commentary array (preferred) or fall back to plays array
  const raw = commentary as { commentary?: Array<{ play?: RawPlay }>; plays?: RawPlay[] };
  const plays: RawPlay[] = (raw?.commentary?.map((c) => c.play).filter(Boolean) as RawPlay[]) ??
    raw?.plays ??
    [];
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

// ─── Live tab (Phase 5) ─────────────────────────────────────────────────────

export function LiveTab({ match }: { match: Match }) {
  const { lang } = useSettings();
  const { data, isLoading } = useLivePlays(match.espnId, !!match.isLive);
  if (isLoading)
    return (
      <div className="modal-tab-loading">
        <div className="spinner" />
      </div>
    );
  const plays = parseLivePlays(data, match.team1.espnId);
  if (!plays.length) return <p className="modal-tab-empty">{t(lang, "noEvents")}</p>;
  return (
    <ul className="live-feed">
      {plays.map((p) => (
        <li
          key={p.id}
          className={`live-feed__item${p.scoringPlay ? " live-feed__item--goal" : ""}${
            p.side ? ` live-feed__item--${p.side}` : ""
          }`}
        >
          {p.clock && <span className="live-feed__clock">{p.clock}</span>}
          <span className="live-feed__text">
            {p.scoringPlay && <span className="ev-icon ev-icon--ball" aria-hidden="true">⚽</span>}
            {p.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Close icon ─────────────────────────────────────────────────────────────

export function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      width="20"
      height="20"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Tab types (expanded per phase) ─────────────────────────────────────────

export type ModalTab = "overview" | "timeline" | "stats" | "lineup";

// ─── Main modal ─────────────────────────────────────────────────────────────

export interface MatchModalProps {
  match: Match;
  onClose: () => void;
  onTeamClick: (name: string) => void;
  onPlayerClick?: (id: string, name: string, teamEspnId: string) => void;
}

export default function MatchModal({
  match,
  onClose,
  onTeamClick,
  onPlayerClick,
}: MatchModalProps) {
  const { lang, myTeams } = useSettings();
  const isMyMatch =
    myTeams.includes(match.team1.name) || myTeams.includes(match.team2.name);
  const hasData = (match.isLive || match.played) && !!match.espnId;

  const storedTab = lsGet("wc2026:modal-tab") as ModalTab | null;
  const validTabs: ModalTab[] = ["overview", "timeline", "stats", "lineup"];
  const defaultTab: ModalTab = hasData
    ? (storedTab && validTabs.includes(storedTab) ? storedTab : "timeline")
    : "overview";
  const [tab, setTab] = useState<ModalTab>(defaultTab);

  const handleTabChange = useCallback((id: ModalTab) => {
    setTab(id);
    lsSet("wc2026:modal-tab", id);
  }, []);

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);

  const touchStartY = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 80 && (modalRef.current?.scrollTop ?? 0) === 0) onClose();
  }, [onClose]);

  const locale = lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES";

  const tabs: Array<{ id: ModalTab; label: string }> = [
    { id: "overview", label: t(lang, "tabOverview") },
    ...(hasData
      ? [
          { id: "timeline" as ModalTab, label: t(lang, "tabTimeline") },
          { id: "stats" as ModalTab, label: t(lang, "tabStats") },
          { id: "lineup" as ModalTab, label: t(lang, "tabLineup") },
        ]
      : []),
  ];

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`${match.team1.name} vs ${match.team2.name}`}
    >
      <div
        ref={modalRef}
        className={`match-modal${isMyMatch ? " match-modal--mine" : ""}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <button className="sheet-close-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>

        {/* Teams + score */}
        <div className="match-modal__teams">
          <button
            className="match-modal__team"
            onClick={() => {
              onClose();
              onTeamClick(match.team1.name);
            }}
            aria-label={match.team1.name}
          >
            <FlagIcon team={match.team1.name} size={48} />
            <span title={match.team1.name}>
              {match.team1.name.length > 14 ? match.team1.abbr : match.team1.name}
            </span>
          </button>

          <div className="match-modal__score">
            {(match.isLive || match.played) && match.score ? (
              <>
                <div className="match-modal__scoreline">
                  {match.score.home} – {match.score.away}
                </div>
                <div
                  className={`match-card__status${match.isLive ? " match-card__status--live" : ""}`}
                >
                  {match.isLive && <span className="live-dot" />}
                  {match.isLive
                    ? match.liveMinute || t(lang, "live")
                    : match.isPenalties
                    ? t(lang, "penalties")
                    : t(lang, "final")}
                </div>
              </>
            ) : (
              <div className="match-modal__time">
                {match.kickoff
                  ? new Intl.DateTimeFormat(locale, {
                      timeZone: TZ,
                      hour: "2-digit",
                      minute: "2-digit",
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    }).format(match.kickoff)
                  : "TBD"}
              </div>
            )}
          </div>

          <button
            className="match-modal__team"
            onClick={() => {
              onClose();
              onTeamClick(match.team2.name);
            }}
            aria-label={match.team2.name}
          >
            <FlagIcon team={match.team2.name} size={48} />
            <span title={match.team2.name}>
              {match.team2.name.length > 14 ? match.team2.abbr : match.team2.name}
            </span>
          </button>
        </div>

        {/* Tab bar */}
        {tabs.length > 1 && (
          <div className="match-modal__tabs" role="tablist">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                role="tab"
                aria-selected={tab === tb.id}
                className={`match-modal__tab${tab === tb.id ? " active" : ""}`}
                onClick={() => handleTabChange(tb.id)}
              >
                {tb.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        <div key={tab} className="match-modal__panel">
          {tab === "overview" && <OverviewTab match={match} locale={locale} />}
          {tab === "timeline" && hasData && (
            match.isLive
              ? <LiveTab match={match} />
              : <EventsTab match={match} onPlayerClick={onPlayerClick} />
          )}
          {tab === "stats" && hasData && <StatsTab match={match} />}
          {tab === "lineup" && hasData && (
            <LineupTab match={match} onPlayerClick={onPlayerClick} />
          )}
        </div>
      </div>
    </div>
  );
}

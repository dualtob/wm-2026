import { useState } from "react";
import FlagIcon from "./FlagIcon";
import { useSettings } from "../contexts/SettingsContext";
import { useMatchGoals } from "../hooks/useMatchDetail";
import { t } from "../i18n";
import type { Match, MatchEvent, EventKind } from "../types";
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

export type ModalTab = "overview" | "events" | "stats" | "lineup";

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
  const { lang } = useSettings();
  const [tab, setTab] = useState<ModalTab>("overview");

  const hasData = (match.isLive || match.played) && !!match.espnId;
  const locale = lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES";

  const tabs: Array<{ id: ModalTab; label: string }> = [
    { id: "overview", label: t(lang, "tabOverview") },
    ...(hasData ? [{ id: "events" as ModalTab, label: t(lang, "tabEvents") }] : []),
  ];

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`${match.team1.name} vs ${match.team2.name}`}
    >
      <div className="match-modal">
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
            <span>{match.team1.name}</span>
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
            <span>{match.team2.name}</span>
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
                onClick={() => setTab(tb.id)}
              >
                {tb.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        {tab === "overview" && <OverviewTab match={match} locale={locale} />}
        {tab === "events" && hasData && (
          <EventsTab match={match} onPlayerClick={onPlayerClick} />
        )}
      </div>
    </div>
  );
}

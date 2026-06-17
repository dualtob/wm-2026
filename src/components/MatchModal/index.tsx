import "./MatchModal.css";
import { useState, useCallback, useRef } from "react";
import { lsGet, lsSet } from "../../utils/storage";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import FlagIcon from "../FlagIcon";
import { useSettings } from "../../contexts/SettingsContext";
import { t } from "../../i18n";
import { TZ } from "../../constants";
import type { Match } from "../../types";
import OverviewTab from "./OverviewTab";
import EventsTab from "./EventsTab";
import StatsTab from "./StatsTab";
import LineupTab from "./LineupTab";
import LiveTab from "./LiveTab";

export type ModalTab = "overview" | "timeline" | "stats" | "lineup";

export interface MatchModalProps {
  match: Match;
  onClose: () => void;
  onTeamClick: (name: string) => void;
  onPlayerClick?: (id: string, name: string, teamEspnId: string) => void;
}

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
    ? storedTab && validTabs.includes(storedTab)
      ? storedTab
      : "timeline"
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
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const delta = e.changedTouches[0].clientY - touchStartY.current;
      if (delta > 80 && (modalRef.current?.scrollTop ?? 0) === 0) onClose();
    },
    [onClose]
  );

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

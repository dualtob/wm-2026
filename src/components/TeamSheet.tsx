import "./TeamSheet.css";
import { useState, useCallback, useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import FlagIcon from "./FlagIcon";
import MatchCard from "./MatchCard";
import { getTeam } from "../teams";
import { t } from "../i18n";
import { useTeamRoster } from "../hooks/useTeamRoster";
import { useTeamOdds } from "../hooks/useTeamOdds";
import type { Match, RosterGroup, TeamOdds, Lang, StandingRow, Standings } from "../types";

interface OddsBarProps {
  label: string;
  probability: number | null | undefined;
}

function OddsBar({ label, probability }: OddsBarProps) {
  if (probability === null || probability === undefined) return null;
  const pct = Math.round(probability * 100);
  return (
    <div className="odds-bar">
      <div className="odds-bar__label">{label}</div>
      <div className="odds-bar__track">
        <div className="odds-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="odds-bar__value">{pct}%</div>
    </div>
  );
}

interface SquadSectionProps {
  title: string;
  players: RosterGroup[keyof RosterGroup];
}

function SquadSection({ title, players }: SquadSectionProps) {
  if (!players?.length) return null;
  return (
    <div className="squad-section">
      <h4 className="squad-section__title">{title}</h4>
      <div className="squad-list">
        {players.map((p) => (
          <div key={p.id || p.name} className="squad-player">
            <span className="squad-player__jersey">#{p.jersey ?? "–"}</span>
            {p.headshot && (
              <img
                className="squad-player__headshot"
                src={p.headshot}
                alt={p.name}
                width={32}
                height={32}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="squad-player__info">
              <span className="squad-player__name">{p.name}</span>
              <span className="squad-player__pos">{p.position}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniGroupTable({
  groupName,
  rows,
  teamName,
}: {
  groupName: string;
  rows: StandingRow[];
  teamName: string;
}) {
  return (
    <div className="mini-group">
      <p className="mini-group__title">{groupName}</p>
      <table className="mini-group__table">
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.team}
              className={`mini-group__row${row.team === teamName ? " mini-group__row--self" : ""}${idx < 2 ? " mini-group__row--qualify" : ""}`}
            >
              <td className="mini-group__pos">{idx + 1}</td>
              <td className="mini-group__team">
                <FlagIcon team={row.team} size={14} />
                <span>{row.team}</span>
              </td>
              <td className="mini-group__num">{row.played}</td>
              <td className="mini-group__num">{row.points}</td>
              <td className="mini-group__num mini-group__gd">
                {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TeamSheetProps {
  teamName: string;
  matches: Match[];
  lang: Lang;
  myTeams: string[];
  standings?: Standings;
  onToggleMyTeam?: (name: string) => void;
  onClose: () => void;
  onMatchClick?: (match: Match) => void;
}

export default function TeamSheet({
  teamName,
  matches,
  lang,
  myTeams,
  standings,
  onToggleMyTeam,
  onClose,
  onMatchClick,
}: TeamSheetProps) {
  const [activeTab, setActiveTab] = useState<"squad" | "matches">("squad");

  const team = getTeam(teamName);
  const teamColor = team ? `#${team.color}` : "#0a9d72";
  const isFollowing = myTeams?.includes(teamName);

  const { data: roster, isLoading: rosterLoading } = useTeamRoster(
    activeTab === "squad" ? team?.espnId : null
  );
  const { data: odds } = useTeamOdds(teamName);

  const teamMatches = matches
    .filter((m) => m.team1.name === teamName || m.team2.name === teamName)
    .sort((a, b) => (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0));

  // Find which group this team is in
  const groupEntry = standings
    ? Object.entries(standings).find(([, rows]) => rows.some((r) => r.team === teamName))
    : null;
  const groupName = groupEntry ? groupEntry[0] : null;
  const groupRows = groupEntry ? groupEntry[1] : null;

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, true);
  const touchStartY = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.changedTouches[0].clientY - touchStartY.current > 80) onClose();
  }, [onClose]);

  const oddsData = odds as TeamOdds | null | undefined;

  return (
    <div
      className="sheet-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={teamName}
    >
      <div ref={sheetRef} className="team-sheet" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="sheet-handle" aria-hidden="true" />
        <div
          className="team-sheet__header"
          style={{ "--team-color": teamColor } as React.CSSProperties}
        >
          <button className="sheet-close-btn" onClick={onClose} aria-label="Close">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="team-sheet__flag">
            <FlagIcon team={teamName} size={56} />
          </div>
          <h2 className="team-sheet__name">{teamName}</h2>
          {team?.abbr && <span className="team-sheet__abbr">{team.abbr}</span>}
          <button
            className={`follow-btn ${isFollowing ? "follow-btn--active" : ""}`}
            onClick={() => onToggleMyTeam?.(teamName)}
          >
            {isFollowing ? "★ " + t(lang, "selFollowed") : "☆ " + t(lang, "filterMine")}
          </button>
        </div>

        {oddsData &&
          (oddsData.advance !== null ||
            oddsData.winGroup !== null ||
            oddsData.reachFinal !== null) && (
            <div className="team-odds">
              <h3 className="team-odds__title">{t(lang, "teamPredTitle")}</h3>
              <OddsBar label={t(lang, "predAdvance")} probability={oddsData.advance} />
              <OddsBar label={t(lang, "predWinGroup")} probability={oddsData.winGroup} />
              <OddsBar label={t(lang, "predReachFinal")} probability={oddsData.reachFinal} />
              {oddsData.winChampion !== null && (
                <OddsBar label={t(lang, "predChampion")} probability={oddsData.winChampion} />
              )}
              <p className="team-odds__attribution">{t(lang, "predAttribution")}</p>
            </div>
          )}

        {groupName && groupRows && (
          <MiniGroupTable groupName={groupName} rows={groupRows} teamName={teamName} />
        )}

        <div className="segment-control" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "squad"}
            className={`segment-btn ${activeTab === "squad" ? "segment-btn--active" : ""}`}
            onClick={() => setActiveTab("squad")}
          >
            {t(lang, "teamSquad")}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "matches"}
            className={`segment-btn ${activeTab === "matches" ? "segment-btn--active" : ""}`}
            onClick={() => setActiveTab("matches")}
          >
            {t(lang, "teamMatches")}
          </button>
        </div>

        {activeTab === "squad" && (
          <div className="team-sheet__content">
            {rosterLoading ? (
              <div className="loading-hint">
                <div className="spinner" />
                <p>{t(lang, "teamSquadLoading")}</p>
              </div>
            ) : !roster || Object.values(roster).every((arr) => arr.length === 0) ? (
              <p className="empty-hint">{t(lang, "teamSquadNA")}</p>
            ) : (
              <>
                <SquadSection title={t(lang, "posG")} players={roster.G} />
                <SquadSection title={t(lang, "posD")} players={roster.D} />
                <SquadSection title={t(lang, "posM")} players={roster.M} />
                <SquadSection title={t(lang, "posF")} players={roster.F} />
              </>
            )}
          </div>
        )}

        {activeTab === "matches" && (
          <div className="team-sheet__content">
            {teamMatches.length === 0 ? (
              <p className="empty-hint">{t(lang, "emptyNoUpcoming")}</p>
            ) : (
              teamMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  lang={lang}
                  myTeams={myTeams}
                  onMatchClick={onMatchClick}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

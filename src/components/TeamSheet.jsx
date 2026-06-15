import { useState, useEffect, useCallback } from "react";
import FlagIcon from "./FlagIcon.jsx";
import MatchCard from "./MatchCard.jsx";
import { fetchTeamRoster } from "../api/espn.js";
import { fetchTeamOdds } from "../api/polymarket.js";
import { getTeam } from "../teams.js";
import { t } from "../i18n.js";

function OddsBar({ label, probability }) {
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

function SquadSection({ title, players }) {
  if (!players?.length) return null;
  return (
    <div className="squad-section">
      <h4 className="squad-section__title">{title}</h4>
      <div className="squad-list">
        {players.map((p) => (
          <div key={p.id || p.name} className="squad-player">
            <span className="squad-player__jersey">#{p.jersey || "–"}</span>
            {p.headshot && (
              <img
                className="squad-player__headshot"
                src={p.headshot}
                alt={p.name}
                width={32}
                height={32}
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
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

export default function TeamSheet({ teamName, matches, lang, myTeams, onToggleMyTeam, onClose, onMatchClick }) {
  const [activeTab, setActiveTab] = useState("squad");
  const [roster, setRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [odds, setOdds] = useState(null);
  const team = getTeam(teamName);
  const teamColor = team ? `#${team.color}` : "#0a9d72";
  const isFollowing = myTeams?.includes(teamName);

  const teamMatches = matches.filter(
    (m) => m.team1.name === teamName || m.team2.name === teamName
  ).sort((a, b) => (a.kickoff || 0) - (b.kickoff || 0));

  // Load roster when squad tab active
  useEffect(() => {
    if (activeTab !== "squad" || !team?.espnId) return;
    if (roster !== null) return;

    setRosterLoading(true);
    fetchTeamRoster(team.espnId)
      .then((data) => {
        setRoster(data);
        setRosterLoading(false);
      })
      .catch(() => {
        setRoster(null);
        setRosterLoading(false);
      });
  }, [activeTab, team?.espnId]);

  // Load Polymarket odds
  useEffect(() => {
    fetchTeamOdds(teamName)
      .then(setOdds)
      .catch(() => setOdds(null));
  }, [teamName]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label={teamName}>
      <div className="team-sheet">
        {/* Header */}
        <div className="team-sheet__header" style={{ "--team-color": teamColor }}>
          <button className="sheet-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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

        {/* Polymarket odds */}
        {odds && (odds.advance !== null || odds.winGroup !== null || odds.reachFinal !== null) && (
          <div className="team-odds">
            <h3 className="team-odds__title">{t(lang, "teamPredTitle")}</h3>
            <OddsBar label={t(lang, "predAdvance")} probability={odds.advance} />
            <OddsBar label={t(lang, "predWinGroup")} probability={odds.winGroup} />
            <OddsBar label={t(lang, "predReachFinal")} probability={odds.reachFinal} />
            {odds.winChampion !== null && (
              <OddsBar label={t(lang, "predChampion")} probability={odds.winChampion} />
            )}
            <p className="team-odds__attribution">{t(lang, "predAttribution")}</p>
          </div>
        )}

        {/* Tabs */}
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

        {/* Squad tab */}
        {activeTab === "squad" && (
          <div className="team-sheet__content">
            {rosterLoading ? (
              <div className="loading-hint">
                <div className="spinner" />
                <p>{t(lang, "teamSquadLoading")}</p>
              </div>
            ) : !roster || (Object.values(roster).every((arr) => arr.length === 0)) ? (
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

        {/* Matches tab */}
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

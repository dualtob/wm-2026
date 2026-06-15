import FlagIcon from "./FlagIcon.jsx";
import { t } from "../i18n.js";

function formatKickoff(date, lang) {
  if (!date) return "";
  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMatchDate(date, lang, todayStr, tomorrowStr) {
  if (!date) return "";
  const tz = "Europe/Berlin";
  const matchDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date);
  if (matchDate === todayStr) return tomorrowStr ? t(lang, "relToday") : t(lang, "relToday");

  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export default function MatchCard({ match, lang, onTeamClick, onMatchClick, myTeams = [] }) {
  const { team1, team2, score, played, isLive, liveMinute, kickoff, group, stage, matchday, isPenalties } = match;

  const isMyMatch = myTeams.includes(team1.name) || myTeams.includes(team2.name);

  const statusLabel = isLive
    ? liveMinute || t(lang, "live")
    : played
    ? isPenalties
      ? t(lang, "penalties")
      : t(lang, "final")
    : null;

  const stageLabel = group
    ? `${group}${matchday ? ` · ${t(lang, "matchdayAbbr")}${matchday}` : ""}`
    : stage;

  return (
    <article
      className={`match-card ${isLive ? "match-card--live" : ""} ${isMyMatch ? "match-card--mine" : ""}`}
      onClick={() => onMatchClick?.(match)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onMatchClick?.(match)}
      aria-label={`${team1.name} vs ${team2.name}`}
    >
      {stageLabel && <div className="match-card__stage">{stageLabel}</div>}

      <div className="match-card__body">
        {/* Team 1 */}
        <div
          className="match-card__team"
          onClick={(e) => { e.stopPropagation(); onTeamClick?.(team1.name); }}
        >
          <FlagIcon team={team1.name} size={28} />
          <span className="match-card__team-name">{team1.abbr}</span>
        </div>

        {/* Score / time */}
        <div className="match-card__center">
          {score !== null && score !== undefined ? (
            <div className="match-card__score">
              <span className={score.home > score.away ? "match-card__score-num match-card__score-num--win" : "match-card__score-num"}>
                {score.home}
              </span>
              <span className="match-card__score-sep">–</span>
              <span className={score.away > score.home ? "match-card__score-num match-card__score-num--win" : "match-card__score-num"}>
                {score.away}
              </span>
            </div>
          ) : (
            <div className="match-card__time">
              {kickoff ? formatKickoff(kickoff, lang) : "TBD"}
            </div>
          )}
          {statusLabel && (
            <div className={`match-card__status ${isLive ? "match-card__status--live" : ""}`}>
              {isLive && <span className="live-dot" aria-hidden="true" />}
              {statusLabel}
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div
          className="match-card__team match-card__team--right"
          onClick={(e) => { e.stopPropagation(); onTeamClick?.(team2.name); }}
        >
          <span className="match-card__team-name">{team2.abbr}</span>
          <FlagIcon team={team2.name} size={28} />
        </div>
      </div>

      {match.venue && (
        <div className="match-card__venue">{match.venue}{match.city ? `, ${match.city}` : ""}</div>
      )}
    </article>
  );
}

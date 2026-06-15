import { useState } from "react";
import MatchCard from "./MatchCard.jsx";
import { t } from "../i18n.js";

const TZ = "Europe/Berlin";

function getDateKey(date) {
  if (!date) return "unknown";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function getTomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function formatDateHeader(dateKey, lang, todayKey, tomorrowKey) {
  if (dateKey === todayKey) return t(lang, "relToday");
  if (dateKey === tomorrowKey) return t(lang, "relTomorrow");

  const date = new Date(dateKey + "T12:00:00Z");
  return new Intl.DateTimeFormat(
    lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES",
    { weekday: "long", day: "numeric", month: "long" }
  ).format(date);
}

export default function MatchList({
  matches,
  lang,
  myTeams,
  showFilter,
  onTeamClick,
  onMatchClick,
  mode = "upcoming", // "upcoming" | "results" | "calendar"
}) {
  const [filterMine, setFilterMine] = useState(false);

  const todayKey = getTodayKey();
  const tomorrowKey = getTomorrowKey();

  // Filter by "mine" selection
  const filtered = filterMine && myTeams?.length > 0
    ? matches.filter((m) => myTeams.includes(m.team1.name) || myTeams.includes(m.team2.name))
    : matches;

  // Group by date
  const dateGroups = {};
  for (const m of filtered) {
    const key = getDateKey(m.kickoff);
    if (!dateGroups[key]) dateGroups[key] = [];
    dateGroups[key].push(m);
  }

  const sortedKeys = Object.keys(dateGroups).sort((a, b) => {
    if (mode === "results") return b.localeCompare(a);
    return a.localeCompare(b);
  });

  if (filtered.length === 0) {
    return (
      <div className="empty-state">
        {showFilter && (
          <div className="filter-bar">
            <button
              className={`filter-btn ${filterMine ? "filter-btn--active" : ""}`}
              onClick={() => setFilterMine((v) => !v)}
            >
              {filterMine ? t(lang, "filterAll") : t(lang, "filterMine")}
            </button>
          </div>
        )}
        <div className="empty-state__content">
          <div className="empty-state__icon">⚽</div>
          <p className="empty-state__text">
            {mode === "upcoming" ? t(lang, "emptyNoUpcoming") : t(lang, "emptyNoResults")}
          </p>
          <p className="empty-state__hint">
            {filterMine ? t(lang, "emptyFilterHint") : t(lang, "emptyNoUpcomingHint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`match-list match-list--${mode}`}>
      {showFilter && (
        <div className="filter-bar">
          <button
            className={`filter-btn ${filterMine ? "filter-btn--active" : ""}`}
            onClick={() => setFilterMine((v) => !v)}
          >
            {filterMine ? t(lang, "filterAll") : t(lang, "filterMine")}
          </button>
          {filterMine && myTeams?.length > 0 && (
            <span className="filter-count">
              {filtered.length} {filtered.length === 1 ? t(lang, "matchSingular") : t(lang, "matchPlural")}
            </span>
          )}
        </div>
      )}

      {sortedKeys.map((dateKey) => (
        <section key={dateKey} className="date-group">
          <h2 className="date-group__header">
            {formatDateHeader(dateKey, lang, todayKey, tomorrowKey)}
          </h2>
          <div className="date-group__matches">
            {dateGroups[dateKey].map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                lang={lang}
                myTeams={myTeams}
                onTeamClick={onTeamClick}
                onMatchClick={onMatchClick}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

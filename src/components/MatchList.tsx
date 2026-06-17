import { useState } from "react";
import MatchCard from "./MatchCard";
import { t } from "../i18n";
import type { Match, Lang } from "../types";
import { TZ } from "../constants";

type Mode = "upcoming" | "results" | "calendar";

interface MatchListProps {
  matches: Match[];
  lang: Lang;
  myTeams: string[];
  showFilter: boolean;
  onTeamClick?: (name: string) => void;
  onMatchClick?: (match: Match) => void;
  mode?: Mode;
  markTodayAnchor?: boolean;
}

function getDateKey(date: Date | null): string {
  if (!date) return "unknown";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

function getTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function getTomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function formatDateHeader(dateKey: string, lang: Lang, todayKey: string, tomorrowKey: string): string {
  if (dateKey === todayKey) return t(lang, "relToday");
  if (dateKey === tomorrowKey) return t(lang, "relTomorrow");
  const date = new Date(dateKey + "T12:00:00Z");
  return new Intl.DateTimeFormat(
    lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES",
    { weekday: "long", day: "numeric", month: "long" }
  ).format(date);
}

// Pick the dominant stage label for a day so we can show stage banners
// when the calendar transitions from group stage → knockout etc.
function getDayStage(dayMatches: Match[]): string {
  const counts: Record<string, number> = {};
  for (const m of dayMatches) {
    const k = m.group ? "Group stage" : m.stage || "Unknown";
    counts[k] = (counts[k] ?? 0) + 1;
  }
  let best = "";
  let bestCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    }
  }
  return best;
}

export default function MatchList({
  matches,
  lang,
  myTeams,
  showFilter,
  onTeamClick,
  onMatchClick,
  mode = "upcoming",
  markTodayAnchor = false,
}: MatchListProps) {
  const [filterMine, setFilterMine] = useState(false);

  const todayKey = getTodayKey();
  const tomorrowKey = getTomorrowKey();

  const filtered =
    filterMine && myTeams?.length > 0
      ? matches.filter((m) => myTeams.includes(m.team1.name) || myTeams.includes(m.team2.name))
      : matches;

  const dateGroups: Record<string, Match[]> = {};
  for (const m of filtered) {
    const key = getDateKey(m.kickoff);
    if (!dateGroups[key]) dateGroups[key] = [];
    dateGroups[key].push(m);
  }

  const sortedKeys = Object.keys(dateGroups).sort((a, b) =>
    mode === "results" ? b.localeCompare(a) : a.localeCompare(b)
  );

  // First date key that is today or in the future (for today anchor)
  const todayAnchorKey = markTodayAnchor
    ? sortedKeys.find((k) => k >= todayKey) ?? null
    : null;

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
              {filtered.length}{" "}
              {filtered.length === 1 ? t(lang, "matchSingular") : t(lang, "matchPlural")}
            </span>
          )}
        </div>
      )}

      {sortedKeys.map((dateKey, idx) => {
        const prevStage = idx > 0 ? getDayStage(dateGroups[sortedKeys[idx - 1]]) : null;
        const stage = mode === "calendar" ? getDayStage(dateGroups[dateKey]) : null;
        const showStageBanner = mode === "calendar" && stage && stage !== prevStage;
        return (
          <section
            key={dateKey}
            className="date-group"
            id={dateKey === todayAnchorKey ? "calendar-today" : undefined}
          >
            {showStageBanner && <div className="stage-banner">{stage}</div>}
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
        );
      })}
      <div className="list-end-marker" aria-hidden="true" />
    </div>
  );
}

import { useState, useCallback, useMemo, useTransition, lazy, Suspense } from "react";
import NavBar from "./components/NavBar";
import MatchList from "./components/MatchList";
import FlagIcon from "./components/FlagIcon";
import ErrorBoundary from "./components/ErrorBoundary";
import { computeStandings, mergeEspnScores } from "./api/fixtures";
import { t, getStoredLang, storeLang, LANGS, LANG_LABELS } from "./i18n";
import { useFixtures, useScoreboard } from "./hooks/useFixtures";
import { useChampionOdds } from "./hooks/useChampionOdds";
import type { Match, Lang } from "./types";
import { TZ, LS_MY_TEAMS_KEY } from "./constants";

const Groups = lazy(() => import("./components/Groups"));
const Stats = lazy(() => import("./components/Stats"));
const TeamSheet = lazy(() => import("./components/TeamSheet"));

type TabId = "upcoming" | "calendar" | "groups" | "stats";

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, val: string): void {
  try {
    localStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

function TabSkeleton() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => getStoredLang());
  const [activeTab, setActiveTab] = useState<TabId>("upcoming");
  const [upcomingSubTab, setUpcomingSubTab] = useState<"upcoming" | "results">("upcoming");
  const [, startTransition] = useTransition();

  const [myTeams, setMyTeams] = useState<string[]>(() => {
    try {
      const stored = lsGet(LS_MY_TEAMS_KEY);
      if (stored) return JSON.parse(stored) as string[];
    } catch {
      // ignore
    }
    return [];
  });

  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Data via TanStack Query
  const { data: fixturesResult, isLoading, isError, error, refetch } = useFixtures();
  const rawMatches = fixturesResult?.matches ?? [];

  const hasLive = useMemo(() => rawMatches.some((m) => m.isLive), [rawMatches]);
  const { data: scoreboard } = useScoreboard(hasLive);

  const matches = useMemo(
    () => mergeEspnScores(rawMatches, scoreboard ?? []),
    [rawMatches, scoreboard]
  );

  const standings = useMemo(() => computeStandings(matches), [matches]);

  const { data: championOdds } = useChampionOdds();

  const handleLangChange = useCallback((newLang: Lang) => {
    setLang(newLang);
    storeLang(newLang);
    document.documentElement.lang = newLang;
  }, []);

  const toggleMyTeam = useCallback((teamName: string) => {
    setMyTeams((prev) => {
      const next = prev.includes(teamName)
        ? prev.filter((n) => n !== teamName)
        : [...prev, teamName];
      lsSet(LS_MY_TEAMS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearMyTeams = useCallback(() => {
    setMyTeams([]);
    lsSet(LS_MY_TEAMS_KEY, JSON.stringify([]));
  }, []);

  const upcomingMatches = useMemo(
    () =>
      matches
        .filter((m) => !m.played && !m.isLive && !m.isPlaceholder)
        .sort(
          (a, b) => (a.kickoff?.getTime() ?? Infinity) - (b.kickoff?.getTime() ?? Infinity)
        ),
    [matches]
  );

  const liveMatches = useMemo(() => matches.filter((m) => m.isLive), [matches]);

  const resultMatches = useMemo(
    () =>
      matches
        .filter((m) => m.played && !m.isPlaceholder)
        .sort((a, b) => (b.kickoff?.getTime() ?? 0) - (a.kickoff?.getTime() ?? 0)),
    [matches]
  );

  const handleTabChange = useCallback(
    (tab: TabId) => {
      startTransition(() => setActiveTab(tab));
    },
    [startTransition]
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="app-title">{t(lang, "appTitle")}</h1>
          <div className="app-header__right">
            <button
              className="settings-btn"
              onClick={() => setShowSettings(true)}
              aria-label={t(lang, "language")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="20"
                height="20"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {liveMatches.length > 0 && (
          <div className="live-ticker">
            {liveMatches.map((m) => (
              <button key={m.id} className="live-ticker__item" onClick={() => setOpenMatch(m)}>
                <span className="live-dot" />
                <FlagIcon team={m.team1.name} size={16} />
                <strong>{m.score?.home ?? 0}</strong>
                <span>–</span>
                <strong>{m.score?.away ?? 0}</strong>
                <FlagIcon team={m.team2.name} size={16} />
                <span className="live-ticker__min">{m.liveMinute || t(lang, "live")}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="app-main" id={`panel-${activeTab}`} role="tabpanel">
        {isLoading ? (
          <div className="loading-screen">
            <div className="spinner" />
            <p>{t(lang, "loadingMatches")}</p>
          </div>
        ) : isError && matches.length === 0 ? (
          <div className="error-screen">
            <div className="error-screen__icon">⚠️</div>
            <h2>{t(lang, "errorTitle")}</h2>
            <p className="error-screen__detail">{(error as Error)?.message}</p>
            <button className="btn btn--primary" onClick={() => refetch()}>
              {t(lang, "retry")}
            </button>
          </div>
        ) : (
          <>
            {activeTab === "upcoming" && (
              <div className="tab-panel">
                <div className="subtab-bar">
                  <button
                    className={`subtab-btn ${upcomingSubTab === "upcoming" ? "subtab-btn--active" : ""}`}
                    onClick={() => setUpcomingSubTab("upcoming")}
                  >
                    {t(lang, "tabUpcoming")}
                    {liveMatches.length > 0 && (
                      <span className="subtab-badge">{liveMatches.length}</span>
                    )}
                  </button>
                  <button
                    className={`subtab-btn ${upcomingSubTab === "results" ? "subtab-btn--active" : ""}`}
                    onClick={() => setUpcomingSubTab("results")}
                  >
                    {t(lang, "tabResults")}
                  </button>
                </div>
                {upcomingSubTab === "upcoming" && (
                  <MatchList
                    matches={[...liveMatches, ...upcomingMatches]}
                    lang={lang}
                    myTeams={myTeams}
                    showFilter={true}
                    onTeamClick={setOpenTeam}
                    onMatchClick={setOpenMatch}
                    mode="upcoming"
                  />
                )}
                {upcomingSubTab === "results" && (
                  <MatchList
                    matches={resultMatches}
                    lang={lang}
                    myTeams={myTeams}
                    showFilter={true}
                    onTeamClick={setOpenTeam}
                    onMatchClick={setOpenMatch}
                    mode="results"
                  />
                )}
              </div>
            )}

            {activeTab === "calendar" && (
              <div className="tab-panel">
                <MatchList
                  matches={matches.filter((m) => !m.isPlaceholder && !m.played && !m.isLive)}
                  lang={lang}
                  myTeams={myTeams}
                  showFilter={false}
                  onTeamClick={setOpenTeam}
                  onMatchClick={setOpenMatch}
                  mode="calendar"
                />
              </div>
            )}

            {activeTab === "groups" && (
              <div className="tab-panel">
                <ErrorBoundary>
                  <Suspense fallback={<TabSkeleton />}>
                    <Groups
                      standings={standings}
                      matches={matches}
                      lang={lang}
                      onTeamClick={setOpenTeam}
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}

            {activeTab === "stats" && (
              <div className="tab-panel">
                <ErrorBoundary>
                  <Suspense fallback={<TabSkeleton />}>
                    <Stats lang={lang} />
                  </Suspense>
                </ErrorBoundary>
                {championOdds?.outcomes && championOdds.outcomes.length > 0 && (
                  <div className="champion-odds">
                    <h3 className="champion-odds__title">
                      {t(lang, "predChampion")} · Polymarket
                    </h3>
                    <div className="champion-odds__list">
                      {championOdds.outcomes.slice(0, 10).map((o, i) => (
                        <div key={i} className="champion-odds__item">
                          <span className="champion-odds__rank">{i + 1}</span>
                          <span className="champion-odds__team">{o.outcome}</span>
                          <div className="odds-mini-bar">
                            <div
                              className="odds-mini-bar__fill"
                              style={{ width: `${Math.round(o.probability * 100)}%` }}
                            />
                          </div>
                          <span className="champion-odds__prob">
                            {Math.round(o.probability * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="champion-odds__attr">{t(lang, "predAttribution")}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <NavBar activeTab={activeTab} onTabChange={handleTabChange} lang={lang} />

      {openMatch && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setOpenMatch(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Match detail"
        >
          <div className="match-modal">
            <button
              className="sheet-close-btn"
              onClick={() => setOpenMatch(null)}
              aria-label="Close"
            >
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
            </button>

            <div className="match-modal__teams">
              <div
                className="match-modal__team"
                onClick={() => {
                  setOpenMatch(null);
                  setOpenTeam(openMatch.team1.name);
                }}
              >
                <FlagIcon team={openMatch.team1.name} size={48} />
                <span>{openMatch.team1.name}</span>
              </div>
              <div className="match-modal__score">
                {openMatch.score ? (
                  <>
                    <div className="match-modal__scoreline">
                      {openMatch.score.home} – {openMatch.score.away}
                    </div>
                    <div
                      className={`match-card__status ${openMatch.isLive ? "match-card__status--live" : ""}`}
                    >
                      {openMatch.isLive && <span className="live-dot" />}
                      {openMatch.isLive
                        ? openMatch.liveMinute || t(lang, "live")
                        : openMatch.isPenalties
                        ? t(lang, "penalties")
                        : t(lang, "final")}
                    </div>
                  </>
                ) : (
                  <div className="match-modal__time">
                    {openMatch.kickoff
                      ? new Intl.DateTimeFormat(
                          lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES",
                          {
                            timeZone: TZ,
                            hour: "2-digit",
                            minute: "2-digit",
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          }
                        ).format(openMatch.kickoff)
                      : "TBD"}
                  </div>
                )}
              </div>
              <div
                className="match-modal__team"
                onClick={() => {
                  setOpenMatch(null);
                  setOpenTeam(openMatch.team2.name);
                }}
              >
                <FlagIcon team={openMatch.team2.name} size={48} />
                <span>{openMatch.team2.name}</span>
              </div>
            </div>

            <div className="match-modal__meta">
              {openMatch.stage && (
                <div className="match-modal__meta-row">
                  <span className="match-modal__meta-label">{t(lang, "detailStage")}</span>
                  <span>{openMatch.stage}</span>
                </div>
              )}
              {openMatch.venue && (
                <div className="match-modal__meta-row">
                  <span className="match-modal__meta-label">{t(lang, "detailVenue")}</span>
                  <span>
                    {openMatch.venue}
                    {openMatch.city ? `, ${openMatch.city}` : ""}
                  </span>
                </div>
              )}
              {openMatch.kickoff && (
                <div className="match-modal__meta-row">
                  <span className="match-modal__meta-label">{t(lang, "detailDateTime")}</span>
                  <span>
                    {new Intl.DateTimeFormat(
                      lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES",
                      {
                        timeZone: TZ,
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    ).format(openMatch.kickoff)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {openTeam && (
        <ErrorBoundary>
        <Suspense fallback={null}>
          <TeamSheet
            teamName={openTeam}
            matches={matches}
            lang={lang}
            myTeams={myTeams}
            onToggleMyTeam={toggleMyTeam}
            onClose={() => setOpenTeam(null)}
            onMatchClick={setOpenMatch}
          />
        </Suspense>
        </ErrorBoundary>
      )}

      {showSettings && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}
        >
          <div className="settings-modal">
            <div className="settings-modal__header">
              <h2>{t(lang, "language")}</h2>
              <button
                className="sheet-close-btn"
                onClick={() => setShowSettings(false)}
                aria-label="Close"
              >
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
              </button>
            </div>

            <div className="lang-options">
              {LANGS.map((l) => (
                <button
                  key={l}
                  className={`lang-option ${lang === l ? "lang-option--active" : ""}`}
                  onClick={() => {
                    handleLangChange(l);
                    setShowSettings(false);
                  }}
                >
                  {LANG_LABELS[l]}
                  {lang === l && <span className="lang-option__check">✓</span>}
                </button>
              ))}
            </div>

            <hr className="settings-divider" />

            <div className="settings-section">
              <div className="settings-section__header">
                <h3>{t(lang, "selTitle")}</h3>
                {myTeams.length > 0 && (
                  <button className="link-btn" onClick={clearMyTeams}>
                    {t(lang, "selClearAll")}
                  </button>
                )}
              </div>
              <p className="settings-hint">
                {myTeams.length} {t(lang, "selFollowed")} · {t(lang, "selToggleHint")}
              </p>
              <div className="team-picker">
                {Array.from(
                  new Set(
                    matches
                      .filter((m) => !m.isPlaceholder)
                      .flatMap((m) => [m.team1.name, m.team2.name])
                      .filter(Boolean)
                  )
                )
                  .sort()
                  .map((teamName) => (
                    <button
                      key={teamName}
                      className={`team-pick-btn ${myTeams.includes(teamName) ? "team-pick-btn--active" : ""}`}
                      onClick={() => toggleMyTeam(teamName)}
                    >
                      <FlagIcon team={teamName} size={20} />
                      <span>{teamName}</span>
                    </button>
                  ))}
              </div>
            </div>

            <button
              className="btn btn--primary settings-done-btn"
              onClick={() => setShowSettings(false)}
            >
              {t(lang, "selDone")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

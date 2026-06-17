import { useState, useCallback, useEffect, useRef, useTransition, lazy, Suspense } from "react";
import NavBar from "./components/NavBar";
import MatchList from "./components/MatchList";
import FlagIcon from "./components/FlagIcon";
import ErrorBoundary from "./components/ErrorBoundary";
import PWAPrompt from "./components/PWAPrompt";
import MatchModal from "./components/MatchModal";
import MatchListSkeleton from "./components/MatchListSkeleton";
import TeamPicker from "./components/TeamPicker";
import { useSettings, LANGS, LANG_LABELS } from "./contexts/SettingsContext";
import { useWorldCupData } from "./hooks/useWorldCupData";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { CloseIcon } from "./components/MatchModal";
import { t } from "./i18n";
import type { Match } from "./types";

const Groups = lazy(() => import("./components/Groups"));
const Stats = lazy(() => import("./components/Stats"));
const TeamSheet = lazy(() => import("./components/TeamSheet"));
const PlayerSheet = lazy(() => import("./components/PlayerSheet"));

interface OpenPlayer {
  id: string;
  name: string;
  teamEspnId: string;
}

type TabId = "upcoming" | "calendar" | "groups" | "stats";

function TabSkeleton() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
    </div>
  );
}

export default function App() {
  const {
    lang,
    handleLangChange,
    myTeams,
    toggleMyTeam,
    clearMyTeams,
    showSettings,
    setShowSettings,
  } = useSettings();
  const {
    matches,
    standings,
    liveMatches,
    upcomingMatches,
    resultMatches,
    championOdds,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useWorldCupData();
  const isOnline = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const s = localStorage.getItem("wc2026:activeTab");
    return (["upcoming", "calendar", "groups", "stats"].includes(s ?? "") ? s : "upcoming") as TabId;
  });
  const [upcomingSubTab, setUpcomingSubTab] = useState<"upcoming" | "results">("upcoming");
  const [, startTransition] = useTransition();

  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const [openPlayer, setOpenPlayer] = useState<OpenPlayer | null>(null);

  const handleTabChange = useCallback(
    (tab: TabId) => {
      startTransition(() => setActiveTab(tab));
      localStorage.setItem("wc2026:activeTab", tab);
    },
    [startTransition]
  );

  // Refresh button: brief success flash after fetching completes
  const [refreshDone, setRefreshDone] = useState(false);
  const wasFetching = useRef(isFetching);
  useEffect(() => {
    if (wasFetching.current && !isFetching && !isError) {
      setRefreshDone(true);
      const id = setTimeout(() => setRefreshDone(false), 1000);
      return () => clearTimeout(id);
    }
    wasFetching.current = isFetching;
  }, [isFetching, isError]);

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="app-title">{t(lang, "appTitle")}</h1>
          <div className="app-header__right">
            {!isOnline && <span className="offline-badge">{t(lang, "offline")}</span>}
            <button
              className={`refresh-btn${isFetching ? " refresh-btn--spinning" : ""}${refreshDone ? " refresh-btn--done" : ""}`}
              onClick={() => refetch()}
              aria-label={t(lang, "refresh")}
              disabled={isFetching}
            >
              {refreshDone ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              )}
            </button>
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
          <div className="live-ticker" aria-live="polite" aria-label="Live scores">
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

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="app-main" id={`panel-${activeTab}`} role="tabpanel">
        <ErrorBoundary>
          {isLoading ? (
            <MatchListSkeleton />
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
                  <div className="cal-toolbar">
                    <button
                      className="today-btn"
                      onClick={() =>
                        document
                          .getElementById("calendar-today")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                    >
                      {t(lang, "calToday")} ↓
                    </button>
                  </div>
                  <MatchList
                    matches={matches.filter((m) => !m.isPlaceholder)}
                    lang={lang}
                    myTeams={myTeams}
                    showFilter={false}
                    onTeamClick={setOpenTeam}
                    onMatchClick={setOpenMatch}
                    mode="calendar"
                    markTodayAnchor={true}
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
                        onMatchClick={setOpenMatch}
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
        </ErrorBoundary>
      </main>

      <PWAPrompt />
      <NavBar activeTab={activeTab} onTabChange={handleTabChange} lang={lang} liveCount={liveMatches.length} />

      {/* ── Match modal ─────────────────────────────────────────────────── */}
      {openMatch && (
        <MatchModal
          match={openMatch}
          onClose={() => setOpenMatch(null)}
          onTeamClick={(name) => {
            setOpenMatch(null);
            setOpenTeam(name);
          }}
          onPlayerClick={(id, name, teamEspnId) =>
            setOpenPlayer({ id, name, teamEspnId })
          }
        />
      )}

      {/* ── Player sheet (Phase 4) ─────────────────────────────────────── */}
      {openPlayer && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <PlayerSheet
              playerId={openPlayer.id}
              fallbackName={openPlayer.name}
              fallbackTeamEspnId={openPlayer.teamEspnId}
              onClose={() => setOpenPlayer(null)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* ── Team sheet ──────────────────────────────────────────────────── */}
      {openTeam && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <TeamSheet
              teamName={openTeam}
              matches={matches}
              lang={lang}
              myTeams={myTeams}
              standings={standings}
              onToggleMyTeam={toggleMyTeam}
              onClose={() => setOpenTeam(null)}
              onMatchClick={setOpenMatch}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* ── Settings modal ──────────────────────────────────────────────── */}
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
                <CloseIcon />
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
              <TeamPicker matches={matches} />
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

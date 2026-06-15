import { useState, useEffect, useCallback, useRef } from "react";
import NavBar from "./components/NavBar.jsx";
import MatchList from "./components/MatchList.jsx";
import Groups from "./components/Groups.jsx";
import Stats from "./components/Stats.jsx";
import TeamSheet from "./components/TeamSheet.jsx";
import FlagIcon from "./components/FlagIcon.jsx";
import { fetchFixtures, computeStandings, mergeEspnScores } from "./api/fixtures.js";
import { fetchScoreboard } from "./api/espn.js";
import { fetchChampionOdds } from "./api/polymarket.js";
import { t, getStoredLang, storeLang, LANGS, LANG_LABELS } from "./i18n.js";

const LS_MY_TEAMS = "wc2026:myTeams";
const LIVE_POLL_INTERVAL = 60_000; // 1 minute
const TZ = "Europe/Berlin";

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

function getNow(tz) {
  return new Date();
}

export default function App() {
  const [lang, setLang] = useState(() => getStoredLang());
  const [activeTab, setActiveTab] = useState("upcoming");
  const [upcomingSubTab, setUpcomingSubTab] = useState("upcoming"); // "upcoming" | "results"

  // Data
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Champion odds (for predictions panel)
  const [championOdds, setChampionOdds] = useState(null);

  // My teams selection
  const [myTeams, setMyTeams] = useState(() => {
    try {
      const stored = lsGet(LS_MY_TEAMS);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  // Team sheet
  const [openTeam, setOpenTeam] = useState(null);

  // Match detail modal (simple inline expansion)
  const [openMatch, setOpenMatch] = useState(null);

  // Settings overlay
  const [showSettings, setShowSettings] = useState(false);

  const pollRef = useRef(null);

  // Language change
  const handleLangChange = useCallback((newLang) => {
    setLang(newLang);
    storeLang(newLang);
    document.documentElement.lang = newLang;
  }, []);

  // Toggle my team
  const toggleMyTeam = useCallback((teamName) => {
    setMyTeams((prev) => {
      const next = prev.includes(teamName)
        ? prev.filter((t) => t !== teamName)
        : [...prev, teamName];
      lsSet(LS_MY_TEAMS, JSON.stringify(next));
      return next;
    });
  }, []);

  // Clear all my teams
  const clearMyTeams = useCallback(() => {
    setMyTeams([]);
    lsSet(LS_MY_TEAMS, JSON.stringify([]));
  }, []);

  // Fetch fixtures
  const loadFixtures = useCallback(async () => {
    try {
      const { matches: rawMatches, fromCache: fc } = await fetchFixtures();

      // Merge with ESPN live scores
      const espnEvents = await fetchScoreboard();
      const merged = mergeEspnScores(rawMatches, espnEvents);

      setMatches(merged);
      setStandings(computeStandings(merged));
      setFromCache(fc);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to load fixtures:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadFixtures();
  }, [loadFixtures]);

  // Live polling for scores
  useEffect(() => {
    const hasLive = matches.some((m) => m.isLive);

    // Poll more frequently if there are live matches
    const interval = hasLive ? 30_000 : LIVE_POLL_INTERVAL;

    pollRef.current = setInterval(async () => {
      try {
        const espnEvents = await fetchScoreboard();
        setMatches((prev) => {
          const updated = mergeEspnScores(prev, espnEvents);
          setStandings(computeStandings(updated));
          return updated;
        });
        setLastUpdated(new Date());
      } catch {
        // silent fail
      }
    }, interval);

    return () => clearInterval(pollRef.current);
  }, [matches.some?.((m) => m.isLive)]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      loadFixtures();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadFixtures]);

  // Load champion odds
  useEffect(() => {
    fetchChampionOdds()
      .then(setChampionOdds)
      .catch(() => setChampionOdds(null));
  }, []);

  // Set document language
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Derived match lists
  const now = new Date();
  const upcomingMatches = matches
    .filter((m) => !m.played && !m.isLive && !m.isPlaceholder)
    .sort((a, b) => (a.kickoff || Infinity) - (b.kickoff || Infinity));

  const liveMatches = matches.filter((m) => m.isLive);

  const resultMatches = matches
    .filter((m) => m.played && !m.isPlaceholder)
    .sort((a, b) => (b.kickoff || 0) - (a.kickoff || 0));

  // Format last-updated time
  const updatedLabel = lastUpdated
    ? `${t(lang, "updated")} ${new Intl.DateTimeFormat(
        lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES",
        { timeZone: TZ, hour: "2-digit", minute: "2-digit" }
      ).format(lastUpdated)}`
    : null;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="app-title">{t(lang, "appTitle")}</h1>
          <div className="app-header__right">
            {isOffline && (
              <span className="offline-badge">{t(lang, "offline")}</span>
            )}
            {updatedLabel && !isOffline && (
              <span className="updated-label">{updatedLabel}</span>
            )}
            <button
              className="settings-btn"
              onClick={() => setShowSettings(true)}
              aria-label={t(lang, "language")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Live match ticker (if any live matches) */}
        {liveMatches.length > 0 && (
          <div className="live-ticker">
            {liveMatches.map((m) => (
              <button
                key={m.id}
                className="live-ticker__item"
                onClick={() => setOpenMatch(m)}
              >
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

      {/* Main content */}
      <main className="app-main" id={`panel-${activeTab}`} role="tabpanel">
        {loading ? (
          <div className="loading-screen">
            <div className="spinner" />
            <p>{t(lang, "loadingMatches")}</p>
          </div>
        ) : error && matches.length === 0 ? (
          <div className="error-screen">
            <div className="error-screen__icon">⚠️</div>
            <h2>{t(lang, "errorTitle")}</h2>
            <p className="error-screen__detail">{error}</p>
            <button
              className="btn btn--primary"
              onClick={() => { setLoading(true); loadFixtures(); }}
            >
              {t(lang, "retry")}
            </button>
          </div>
        ) : (
          <>
            {/* Upcoming tab */}
            {activeTab === "upcoming" && (
              <div className="tab-panel">
                {/* Sub-tabs */}
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

            {/* Calendar tab */}
            {activeTab === "calendar" && (
              <div className="tab-panel">
                <MatchList
                  matches={matches.filter((m) => !m.isPlaceholder)}
                  lang={lang}
                  myTeams={myTeams}
                  showFilter={false}
                  onTeamClick={setOpenTeam}
                  onMatchClick={setOpenMatch}
                  mode="calendar"
                />
              </div>
            )}

            {/* Groups tab */}
            {activeTab === "groups" && (
              <div className="tab-panel">
                <Groups
                  standings={standings}
                  matches={matches}
                  lang={lang}
                  onTeamClick={setOpenTeam}
                />
              </div>
            )}

            {/* Stats tab */}
            {activeTab === "stats" && (
              <div className="tab-panel">
                <Stats lang={lang} />
                {/* Champion odds from Polymarket */}
                {championOdds?.outcomes?.length > 0 && (
                  <div className="champion-odds">
                    <h3 className="champion-odds__title">{t(lang, "predChampion")} · Polymarket</h3>
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

      {/* Bottom nav */}
      <NavBar activeTab={activeTab} onTabChange={setActiveTab} lang={lang} />

      {/* Match detail modal */}
      {openMatch && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setOpenMatch(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Match detail"
        >
          <div className="match-modal">
            <button className="sheet-close-btn" onClick={() => setOpenMatch(null)} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="20" height="20">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="match-modal__teams">
              <div className="match-modal__team" onClick={() => { setOpenMatch(null); setOpenTeam(openMatch.team1.name); }}>
                <FlagIcon team={openMatch.team1.name} size={48} />
                <span>{openMatch.team1.name}</span>
              </div>
              <div className="match-modal__score">
                {openMatch.score ? (
                  <>
                    <div className="match-modal__scoreline">
                      {openMatch.score.home} – {openMatch.score.away}
                    </div>
                    <div className={`match-card__status ${openMatch.isLive ? "match-card__status--live" : ""}`}>
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
                          { timeZone: TZ, hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" }
                        ).format(openMatch.kickoff)
                      : "TBD"}
                  </div>
                )}
              </div>
              <div className="match-modal__team" onClick={() => { setOpenMatch(null); setOpenTeam(openMatch.team2.name); }}>
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
                  <span>{openMatch.venue}{openMatch.city ? `, ${openMatch.city}` : ""}</span>
                </div>
              )}
              {openMatch.kickoff && (
                <div className="match-modal__meta-row">
                  <span className="match-modal__meta-label">{t(lang, "detailDateTime")}</span>
                  <span>
                    {new Intl.DateTimeFormat(
                      lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES",
                      { timeZone: TZ, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }
                    ).format(openMatch.kickoff)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team sheet */}
      {openTeam && (
        <TeamSheet
          teamName={openTeam}
          matches={matches}
          lang={lang}
          myTeams={myTeams}
          onToggleMyTeam={toggleMyTeam}
          onClose={() => setOpenTeam(null)}
          onMatchClick={setOpenMatch}
        />
      )}

      {/* Settings overlay */}
      {showSettings && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}
        >
          <div className="settings-modal">
            <div className="settings-modal__header">
              <h2>{t(lang, "language")}</h2>
              <button className="sheet-close-btn" onClick={() => setShowSettings(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="20" height="20">
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
                  onClick={() => { handleLangChange(l); setShowSettings(false); }}
                >
                  {LANG_LABELS[l]}
                  {lang === l && <span className="lang-option__check">✓</span>}
                </button>
              ))}
            </div>

            <hr className="settings-divider" />

            {/* My teams section */}
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
                {Object.keys(
                  Object.fromEntries(
                    matches
                      .filter((m) => !m.isPlaceholder)
                      .flatMap((m) => [m.team1.name, m.team2.name])
                      .filter(Boolean)
                      .map((n) => [n, true])
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

            <button className="btn btn--primary settings-done-btn" onClick={() => setShowSettings(false)}>
              {t(lang, "selDone")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

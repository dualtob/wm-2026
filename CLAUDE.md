# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server → http://localhost:5173/wm-2026/
npm run build      # Production build → dist/ (tsc + Vite + Workbox)
npm run preview    # Serve dist/ locally
npm run lint       # ESLint over src/
npm run format     # Prettier over src/
npm run test       # Vitest (run once)
npm run test:watch # Vitest (watch mode)
npx tsc --noEmit   # Type-check without emitting — run before every commit
```

**Validate changes:** `npx tsc --noEmit && npm run build`

CI (`.github/workflows/deploy.yml`) runs `npm ci && npm run build` on every push to `main` and deploys `dist/` to GitHub Pages at `/wm-2026/`. Node 22 is required (Vite 8 engine constraint).

## Architecture

### Provider tree (`src/main.tsx`)

```
QueryClientProvider (TanStack Query v5)
  └─ SettingsProvider (lang, myTeams, settings modal state)
       └─ App
```

`QueryClient` defaults: `staleTime: 5 min`, `retry: 2`, `refetchOnWindowFocus: false`.

### Data flow

All match data flows through one hook: **`useWorldCupData`** (`src/hooks/useWorldCupData.ts`). It composes:

1. `useFixtures` → calls `fetchFixtures` which fetches OpenFootball JSON (primary: raw.githubusercontent.com, CDN fallback: jsdelivr), parses into `Match[]` via `parseOpenFootball`, caches in localStorage with a 5-min TTL.
2. `useScoreboard` → polls ESPN scoreboard every 60 s (30 s when a match is live). Uses a `useRef` for the `refetchInterval` callback so polling rate changes don't reset the timer.
3. `mergeEspnScores` (`src/api/fixtures.ts`) → joins fixture matches with live ESPN events by `[team1, team2].sort().join("|")` key. Adds `isLive`, `score`, `espnId`, `liveMinute` to matched fixtures.
4. `computeStandings` (`src/api/fixtures.ts`) → derives `Standings` (group tables) from merged matches.
5. `useChampionOdds` → fetches Polymarket winner market.

Detail data (events, stats, lineup, live plays, player profile) is only fetched when a modal opens, via hooks in `src/hooks/`.

### ESPN API layers

Two base URLs in `src/constants.ts`:
- `ESPN_SITE_URL` (`site.api.espn.com/…/soccer/fifa.world`) — scoreboard, match summary, player overview, team roster
- `ESPN_CORE_URL` (`sports.core.api.espn.com/…/soccer/leagues/fifa.world`) — leaders, athlete name resolution

Both are hardcoded to `fifa.world`. Changing competition requires updating these constants and the scoreboard date range.

### ESPN response parsing (`src/api/espn-parsers.ts`)

All pure ESPN-response-to-domain-type transformations live here. Exports:

- `getCompetitionFromDetail(data)` — pulls `competitions[0]` from a detail response
- `parseMatchEvents(data, homeEspnId)` → `MatchEvent[]`
- `parseMatchStats(summary, homeEspnId)` → `MatchStats | null`
- `parseMatchLineup(summary, homeEspnId)` → `MatchLineup | null`
- `parseLivePlays(commentary, homeEspnId)` → `LivePlay[]`

All raw ESPN shape types (`RawDetail`, `RawComp`, `RawStat`, `RawBoxscore`, `RawRosterTeam`, `RawPlay`) are also exported from this file.

### Teams registry (`src/teams.ts`)

`TEAMS: Record<string, TeamData>` maps canonical team name → `{ espnId, abbr, color }`. `normalizeTeamName` handles alias resolution (e.g. "United States" → "USA"). Flag icons are loaded from HatScripts CDN using the team name.

### localStorage keys

All prefixed `wc2026:` — defined in `src/constants.ts`:
- `wc2026:data` / `wc2026:fetchedAt` — cached OpenFootball fixture JSON + timestamp
- `wc2026:espn:scoreboard` — last good scoreboard response (offline fallback)
- `wc2026:myTeams` — followed teams array
- `wc2026:pm:*` — Polymarket search results
- `wc2026:modal-tab` — last-used MatchModal tab
- `wc2026:lang` — UI language preference
- `wc2026:activeTab` — last-used main nav tab

### Code splitting

Four lazy-loaded chunks via `React.lazy`:
- `Groups` — group tables + knockout bracket
- `Stats` — top scorers/assists + champion odds
- `TeamSheet` — team detail bottom sheet
- `PlayerSheet` — player profile bottom sheet

All wrapped in `<ErrorBoundary><Suspense>` at the call site in `App.tsx`. Eagerly loaded: `MatchCard`, `MatchList`, `MatchModal`, `NavBar`.

### Component responsibilities

- **`MatchModal/`** (`src/components/MatchModal/`) — split into one file per tab:
  - `index.tsx` — modal shell, tab bar, `CloseIcon`, swipe-to-dismiss, focus trap
  - `OverviewTab.tsx` — stage, venue, kickoff datetime
  - `EventsTab.tsx` — match events timeline (`EventIcon` private)
  - `StatsTab.tsx` — possession/shots/corners bars (`StatBar` private)
  - `LineupTab.tsx` — pitch view + bench (`PitchHalf`, `PlayerRow`, `LineupColumn`, `parseFormationRows`, `shortName` all private)
  - `LiveTab.tsx` — live commentary feed
  - Tab state persisted in `wc2026:modal-tab`; default tab is `"timeline"` for played/live matches, `"overview"` otherwise.

- **`MatchCard`** — overlay-button pattern: invisible `<button class="match-card__overlay">` covers the card for the primary action, with `<button class="match-card__team">` buttons on top. Features: countdown (`"in Xh Xm"`) for today's upcoming matches within 12 h; Polymarket win-probability bar for today's unstarted matches; losing team fades to 45 % opacity on result cards; share button (Web Share API) on hover.

- **`MatchList`** — date-grouped list with sticky date headers. Has a "My Teams" filter toggle. Calendar mode shows stage-transition banners and sticky stage-filter pills (All / Groups / Knockout).

- **`Groups`** (`src/components/Groups.tsx`) — segments between group tables and horizontal-scrollable knockout bracket.

- **`NavBar`** — shows a red live-badge dot on the Upcoming tab when `liveCount > 0`.

- **`App`** — persists active tab to `wc2026:activeTab`. Implements pull-to-refresh (60 px down-pull from scroll top) and scroll-to-top button (appears after 300 px scroll).

- **`SettingsContext`** — provides `lang`, `myTeams`, `showSettings`. Components call `useSettings()` directly.

### i18n (`src/i18n.ts`)

`strings` object with three top-level keys (`en`, `de`, `es`). The `en` section is the canonical key source — TypeScript derives `StringKey` from it. All three sections must have identical keys. **German strings must use ASCII quotes** — curly quotes break the TypeScript parser inside template literals.

### PWA (`src/hooks/usePWA.ts`)

Uses the native Service Worker API (`navigator.serviceWorker.register`), not `vite-plugin-pwa`'s virtual module (which broke during CI). The Workbox service worker is still generated by `vite-plugin-pwa` at build time.

### CSS (`src/index.css`)

Single file (~2 900 lines). CSS custom properties in `:root` (light) and `@media (prefers-color-scheme: dark)`. Key properties: `--accent`, `--bg-card`, `--bg-modal`, `--border`, `--safe-bottom`, `--sticky-top` (header height + safe-top), `--nav-height`. BEM-style class names. Uses `:has()` for parent-state styling.

## Testing

Vitest with jsdom environment. Config: `vitest.config.ts`. **Current state: 46 green, 4 red (intentional).**

| File | Coverage |
|------|----------|
| `src/api/fixtures.test.ts` | `computeStandings`, `mergeEspnScores` — 15 characterization tests |
| `src/components/MatchModal.test.ts` | all five parse functions in `espn-parsers.ts` — 31 tests |
| `src/api/multiLeague.test.ts` | 4 **intentionally failing** red tests driving multi-league work |

The 4 red tests document two gaps blocking Bundesliga/Premier League support:
1. `computeStandings` ignores `group: null` matches → needs a `"League"` fallback bucket
2. `mergeEspnScores` can't match `"FC Bayern Munich"` (ESPN) to `"Bayern Munich"` (fixture) → needs club aliases in `normalizeTeamName`

## Pending architecture work

- **Multi-league `LeagueConfig`** — make ESPN URLs, fixture source, team registry, and `normalizeTeamName` aliases pluggable per competition. Turn the 4 red tests in `multiLeague.test.ts` green to unlock Bundesliga/Premier League.
- **CSS co-location** — `src/index.css` is a single 2 900-line file; splitting into per-component files would make deletion safe and discovery faster.
- **Settings modal extraction** — the settings overlay in `App.tsx` (~60 lines) could become `SettingsModal.tsx`.
- **Query key factory** — TanStack Query keys are bare string arrays in hooks; a central factory reduces typos and simplifies invalidation.

## Key constraints

- **`vite.config.ts` `base: "/wm-2026/"`** — all asset paths are relative to this subpath. Required for GitHub Pages.
- **Vite 8 requires Node ≥ 20.19 or ≥ 22.12.** CI uses Node 22.
- **`useScoreboard` refetchInterval must use a ref-backed callback** — passing `hasLive` directly as the interval value causes TanStack Query to reset the polling timer on every live-state change.
- **`package-lock.json` must be committed** — CI uses `npm ci`. Run `npm install` and commit the lock file whenever dependencies change.

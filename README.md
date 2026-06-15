# Mundial 2026

A FIFA World Cup 2026 match tracker and dashboard built with React 19 + Vite.

## Features

- Live and upcoming match scores from ESPN
- Full match schedule (group stage + knockout rounds)
- Group standings tables for all 12 groups
- Best third-place team rankings
- Knockout bracket viewer
- Top scorers and assists from ESPN
- Polymarket prediction odds (champion, team probabilities)
- Team detail sheet with squad from ESPN
- My Teams filter (persisted in localStorage)
- Three languages: Spanish (default), English, German
- Dark/light theme following system preference
- Mobile-first, works as a PWA on iOS/Android
- Fully static – no backend required

## Data Sources

- Fixtures: [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json)
- Live scores: [ESPN Scoreboard API](https://site.api.espn.com)
- Predictions: [Polymarket Gamma API](https://gamma-api.polymarket.com)
- Flags: [circle-flags CDN](https://github.com/HatScripts/circle-flags)

## Getting Started

### Install dependencies

```bash
npm install
```

### Run development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder.

### Preview production build locally

```bash
npm run preview
```

## Deployment

The `dist/` folder is a fully static site. You can host it anywhere:

### Netlify

```bash
npm run build
# Drag and drop the dist/ folder to netlify.com/drop
# Or: ntl deploy --prod --dir=dist
```

### Vercel

```bash
npx vercel --prod
```

### GitHub Pages

```bash
npm run build
npx gh-pages -d dist
```

### Serve locally

```bash
npm run build
npx serve dist
```

## Project Structure

```
src/
  main.jsx           # Entry point
  App.jsx            # Main app + data fetching + routing
  teams.js           # Team data, helpers, flag codes
  i18n.js            # Translations (ES, EN, DE)
  index.css          # Global styles
  api/
    fixtures.js      # OpenFootball fixture fetch + parse
    espn.js          # ESPN API (scores, roster, leaders)
    polymarket.js    # Polymarket prediction odds
  components/
    NavBar.jsx       # Bottom tab navigation
    MatchCard.jsx    # Single match display
    MatchList.jsx    # Date-grouped match list
    GroupTable.jsx   # Group standings table
    Groups.jsx       # All groups + best thirds + bracket
    Stats.jsx        # Top scorers and assists
    TeamSheet.jsx    # Team detail bottom sheet
    FlagIcon.jsx     # Circle flag image
```

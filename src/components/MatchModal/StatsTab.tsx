import "./StatsTab.css";
import { useSettings } from "../../contexts/SettingsContext";
import { useMatchSummary } from "../../hooks/useMatchSummary";
import { t } from "../../i18n";
import { parseMatchStats } from "../../api/espn-parsers";
import type { Match } from "../../types";

function StatBar({
  label,
  home,
  away,
  isPercent = false,
}: {
  label: string;
  home: number | null;
  away: number | null;
  isPercent?: boolean;
}) {
  if (home === null && away === null) return null;
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a;
  const homePct = isPercent ? h : total === 0 ? 50 : (h / total) * 100;
  const awayPct = isPercent ? a : 100 - homePct;
  const fmt = (n: number | null) =>
    n === null ? "–" : isPercent ? `${Math.round(n)}%` : String(Math.round(n));
  return (
    <div className="stat-row">
      <div className="stat-row__head">
        <span className="stat-row__num">{fmt(home)}</span>
        <span className="stat-row__label">{label}</span>
        <span className="stat-row__num">{fmt(away)}</span>
      </div>
      <div className="stat-row__bars">
        <div className="stat-row__bar stat-row__bar--home" style={{ width: `${homePct}%` }} />
        <div className="stat-row__bar stat-row__bar--away" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  );
}

export default function StatsTab({ match }: { match: Match }) {
  const { lang } = useSettings();
  const { data, isLoading } = useMatchSummary(match.espnId);
  if (isLoading)
    return (
      <div className="modal-tab-loading">
        <div className="spinner" />
      </div>
    );
  const stats = parseMatchStats(data, match.team1.espnId);
  if (!stats) return <p className="modal-tab-empty">{t(lang, "noStats")}</p>;
  return (
    <div className="stats-tab">
      <StatBar label={t(lang, "statPoss")} home={stats.home.possession} away={stats.away.possession} isPercent />
      <StatBar label={t(lang, "statShots")} home={stats.home.shots} away={stats.away.shots} />
      <StatBar label={t(lang, "statShotsOn")} home={stats.home.shotsOnTarget} away={stats.away.shotsOnTarget} />
      <StatBar label={t(lang, "statCorners")} home={stats.home.corners} away={stats.away.corners} />
      <StatBar label={t(lang, "statFouls")} home={stats.home.fouls} away={stats.away.fouls} />
      <StatBar label={t(lang, "statOffsides")} home={stats.home.offsides} away={stats.away.offsides} />
    </div>
  );
}

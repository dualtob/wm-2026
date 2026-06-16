import FlagIcon from "./FlagIcon";
import { t } from "../i18n";
import type { StandingRow, Lang } from "../types";

interface GroupTableProps {
  groupName: string;
  standings: StandingRow[];
  lang: Lang;
  onTeamClick?: (name: string) => void;
}

export default function GroupTable({ groupName, standings, lang, onTeamClick }: GroupTableProps) {
  if (!standings?.length) return null;

  return (
    <div className="group-table">
      <h3 className="group-table__title">{groupName}</h3>
      <div className="group-table__wrapper">
        <table className="standings-table">
          <thead>
            <tr>
              <th className="col-pos">#</th>
              <th className="col-team">{t(lang, "thTeam")}</th>
              <th className="col-num">{t(lang, "thMP")}</th>
              <th className="col-num">{t(lang, "thW")}</th>
              <th className="col-num">{t(lang, "thD")}</th>
              <th className="col-num">{t(lang, "thL")}</th>
              <th className="col-num col-goals">{t(lang, "thGF")}:{t(lang, "thGA")}</th>
              <th className="col-num">{t(lang, "thGD")}</th>
              <th className="col-num col-pts">{t(lang, "thPts")}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, idx) => {
              const rowClass = idx < 2 ? "qualify" : idx === 2 ? "third" : "out";
              return (
                <tr
                  key={row.team}
                  className={`standings-row standings-row--${rowClass}`}
                  onClick={() => onTeamClick?.(row.team)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="col-pos">{idx + 1}</td>
                  <td className="col-team">
                    <div className="team-cell">
                      <FlagIcon team={row.team} size={18} />
                      <span className="team-cell__name">{row.team}</span>
                    </div>
                  </td>
                  <td className="col-num">{row.played}</td>
                  <td className="col-num">{row.won}</td>
                  <td className="col-num">{row.drawn}</td>
                  <td className="col-num">{row.lost}</td>
                  <td className="col-num col-goals">
                    <span className="col-goals__gf">{row.goalsFor}</span>
                    <span className="col-goals__sep">:</span>
                    <span className="col-goals__ga">{row.goalsAgainst}</span>
                  </td>
                  <td className="col-num">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                  <td className="col-num col-pts">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="group-legend">
        <span className="legend-item legend-item--qualify">{t(lang, "legendQualify")}</span>
        <span className="legend-item legend-item--third">{t(lang, "legendThird")}</span>
        <span className="legend-item legend-item--out">{t(lang, "legendOut")}</span>
      </div>
    </div>
  );
}

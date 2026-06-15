import { useState } from "react";
import GroupTable from "./GroupTable";
import FlagIcon from "./FlagIcon";
import { t } from "../i18n";
import type { Match, Standings, StandingRow, Lang } from "../types";

type ThirdRow = StandingRow & { group: string };

function getBestThirds(standings: Standings): ThirdRow[] {
  const thirds: ThirdRow[] = [];
  for (const [groupName, rows] of Object.entries(standings)) {
    if (rows[2]) thirds.push({ ...rows[2], group: groupName });
  }
  return thirds
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.localeCompare(b.team);
    })
    .slice(0, 8);
}

const ROUND_ORDER = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "Third place",
  "Final",
];

function KnockoutBracket({ matches, lang }: { matches: Match[]; lang: Lang }) {
  const knockoutMatches = matches.filter((m) => !m.group && !m.isPlaceholder);
  const rounds: Record<string, Match[]> = {};
  for (const m of knockoutMatches) {
    const stage = m.stage || "Unknown";
    if (!rounds[stage]) rounds[stage] = [];
    rounds[stage].push(m);
  }

  const sortedRounds = Object.keys(rounds).sort((a, b) => {
    const ia = ROUND_ORDER.findIndex((r) => a.includes(r));
    const ib = ROUND_ORDER.findIndex((r) => b.includes(r));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  if (sortedRounds.length === 0) {
    return (
      <div className="bracket-empty">
        <p>{t(lang, "bracketEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="bracket">
      {sortedRounds.map((roundName) => (
        <div key={roundName} className="bracket__round">
          <h4 className="bracket__round-title">{roundName}</h4>
          <div className="bracket__matches">
            {rounds[roundName].map((m) => (
              <div key={m.id} className="bracket__match">
                <div className="bracket__team">
                  <FlagIcon team={m.team1.name} size={16} />
                  <span>{m.team1.name}</span>
                  {m.score && <strong>{m.score.home}</strong>}
                </div>
                <div className="bracket__team">
                  <FlagIcon team={m.team2.name} size={16} />
                  <span>{m.team2.name}</span>
                  {m.score && <strong>{m.score.away}</strong>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface GroupsProps {
  standings: Standings;
  matches: Match[];
  lang: Lang;
  onTeamClick?: (name: string) => void;
}

export default function Groups({ standings, matches, lang, onTeamClick }: GroupsProps) {
  const [segment, setSegment] = useState<"groups" | "knockout">("groups");
  const sortedGroups = Object.keys(standings).sort();
  const bestThirds = getBestThirds(standings);

  return (
    <div className="groups-view">
      <div className="segment-control" role="tablist">
        <button
          role="tab"
          aria-selected={segment === "groups"}
          className={`segment-btn ${segment === "groups" ? "segment-btn--active" : ""}`}
          onClick={() => setSegment("groups")}
        >
          {t(lang, "segGroups")}
        </button>
        <button
          role="tab"
          aria-selected={segment === "knockout"}
          className={`segment-btn ${segment === "knockout" ? "segment-btn--active" : ""}`}
          onClick={() => setSegment("knockout")}
        >
          {t(lang, "segKnockout")}
        </button>
      </div>

      {segment === "groups" && (
        <div className="groups-list">
          {sortedGroups.map((groupName) => (
            <GroupTable
              key={groupName}
              groupName={groupName}
              standings={standings[groupName]}
              lang={lang}
              onTeamClick={onTeamClick}
            />
          ))}

          {bestThirds.length > 0 && (
            <div className="best-thirds">
              <h3 className="best-thirds__title">{t(lang, "thirdTitle")}</h3>
              <p className="best-thirds__hint">{t(lang, "thirdHint")}</p>
              <div className="group-table__wrapper">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th className="col-pos">#</th>
                      <th className="col-team">{t(lang, "thTeam")}</th>
                      <th className="col-num">{t(lang, "group")}</th>
                      <th className="col-num">{t(lang, "thMP")}</th>
                      <th className="col-num">{t(lang, "thGD")}</th>
                      <th className="col-num col-pts">{t(lang, "thPts")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestThirds.map((row, idx) => (
                      <tr
                        key={row.team}
                        className={`standings-row ${idx < 8 ? "standings-row--qualify" : "standings-row--out"}`}
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
                        <td className="col-num">{row.group?.replace("Group ", "")}</td>
                        <td className="col-num">{row.played}</td>
                        <td className="col-num">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                        <td className="col-num col-pts">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {segment === "knockout" && <KnockoutBracket matches={matches} lang={lang} />}
    </div>
  );
}

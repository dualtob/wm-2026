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

function BracketMatch({
  match,
  onMatchClick,
}: {
  match: Match;
  onMatchClick?: (m: Match) => void;
}) {
  const homeWin = match.played && match.score != null && match.score.home > match.score.away;
  const awayWin = match.played && match.score != null && match.score.away > match.score.home;
  return (
    <button
      className={`bm${match.isLive ? " bm--live" : ""}${match.played ? " bm--played" : ""}`}
      onClick={() => onMatchClick?.(match)}
      disabled={!onMatchClick}
    >
      <div className={`bm__team${homeWin ? " bm__team--win" : ""}${awayWin ? " bm__team--lose" : ""}`}>
        <FlagIcon team={match.team1.name} size={14} />
        <span className="bm__name">{match.team1.abbr}</span>
        {match.score != null && <span className="bm__score">{match.score.home}</span>}
      </div>
      <div className={`bm__team${awayWin ? " bm__team--win" : ""}${homeWin ? " bm__team--lose" : ""}`}>
        <FlagIcon team={match.team2.name} size={14} />
        <span className="bm__name">{match.team2.abbr}</span>
        {match.score != null && <span className="bm__score">{match.score.away}</span>}
      </div>
      {match.isLive && (
        <div className="bm__live">
          <span className="live-dot" aria-hidden="true" />
          {match.liveMinute}
        </div>
      )}
    </button>
  );
}

function KnockoutBracket({
  matches,
  lang,
  onMatchClick,
}: {
  matches: Match[];
  lang: Lang;
  onMatchClick?: (m: Match) => void;
}) {
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
    <div className="bracket-scroll" role="region" aria-label="Knockout bracket">
      <div className="bracket-track">
        {sortedRounds.map((roundName) => (
          <div key={roundName} className="bracket-col">
            <h4 className="bracket-col__title">{roundName}</h4>
            <div className="bracket-col__matches">
              {rounds[roundName].map((m) => (
                <BracketMatch key={m.id} match={m} onMatchClick={onMatchClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface GroupsProps {
  standings: Standings;
  matches: Match[];
  lang: Lang;
  onTeamClick?: (name: string) => void;
  onMatchClick?: (match: Match) => void;
}

export default function Groups({ standings, matches, lang, onTeamClick, onMatchClick }: GroupsProps) {
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

      {segment === "knockout" && <KnockoutBracket matches={matches} lang={lang} onMatchClick={onMatchClick} />}
    </div>
  );
}

import "./LineupTab.css";
import { useSettings } from "../../contexts/SettingsContext";
import { useMatchSummary } from "../../hooks/useMatchSummary";
import { t } from "../../i18n";
import { parseMatchLineup } from "../../api/espn-parsers";
import type { Match, LineupPlayer } from "../../types";

function parseFormationRows(formation: string | null, starters: LineupPlayer[]): LineupPlayer[][] {
  if (!formation || !starters.length) return [starters];
  const nums = formation.split("-").map(Number).filter((n) => !isNaN(n) && n > 0);
  const slots = [1, ...nums];
  const rows: LineupPlayer[][] = [];
  let idx = 0;
  for (const count of slots) {
    rows.push(starters.slice(idx, idx + count));
    idx += count;
  }
  return rows;
}

function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length <= 1) return name;
  return parts[parts.length - 1].length > 10
    ? parts[parts.length - 1].slice(0, 9) + "…"
    : parts[parts.length - 1];
}

function PitchHalf({
  players,
  formation,
  teamEspnId,
  reversed,
  onPlayerClick,
}: {
  players: LineupPlayer[];
  formation: string | null;
  teamEspnId: string;
  reversed: boolean;
  onPlayerClick?: (id: string, name: string, teamEspnId: string) => void;
}) {
  const rows = parseFormationRows(formation, players.filter((p) => p.starter));
  const displayRows = reversed ? [...rows].reverse() : rows;
  return (
    <div className={`pitch-half${reversed ? " pitch-half--away" : ""}`}>
      {displayRows.map((row, i) => (
        <div key={i} className="pitch-row">
          {row.map((p) => (
            <button
              key={p.id || p.name}
              className="pitch-player"
              onClick={() => p.id && onPlayerClick?.(p.id, p.name, teamEspnId)}
              disabled={!p.id || !onPlayerClick}
            >
              <span className="pitch-player__dot">{p.jersey ?? ""}</span>
              <span className="pitch-player__name">{shortName(p.name)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function PlayerRow({
  player,
  onClick,
}: {
  player: LineupPlayer;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="lp-jersey">{player.jersey ?? "–"}</span>
      <span className="lp-name">{player.name}</span>
      <span className="lp-pos">{player.position}</span>
    </>
  );
  if (onClick && player.id) {
    return (
      <button className="lp-row lp-row--btn" onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className="lp-row">{content}</div>;
}

function LineupColumn({
  title,
  players,
  formation,
  teamEspnId,
  onPlayerClick,
}: {
  title: string;
  players: LineupPlayer[];
  formation: string | null;
  teamEspnId: string;
  onPlayerClick?: (id: string, name: string, teamEspnId: string) => void;
}) {
  const { lang } = useSettings();
  const starters = players.filter((p) => p.starter);
  const bench = players.filter((p) => !p.starter);
  return (
    <div className="lp-col">
      <h4 className="lp-col__title">
        {title}
        {formation && <span className="lp-col__formation">{formation}</span>}
      </h4>
      {starters.length > 0 && (
        <>
          <p className="lp-group__label">{t(lang, "starters")}</p>
          {starters.map((p) => (
            <PlayerRow
              key={p.id || p.name}
              player={p}
              onClick={onPlayerClick && p.id ? () => onPlayerClick(p.id, p.name, teamEspnId) : undefined}
            />
          ))}
        </>
      )}
      {bench.length > 0 && (
        <>
          <p className="lp-group__label">{t(lang, "bench")}</p>
          {bench.map((p) => (
            <PlayerRow
              key={p.id || p.name}
              player={p}
              onClick={onPlayerClick && p.id ? () => onPlayerClick(p.id, p.name, teamEspnId) : undefined}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default function LineupTab({
  match,
  onPlayerClick,
}: {
  match: Match;
  onPlayerClick?: (id: string, name: string, teamEspnId: string) => void;
}) {
  const { lang } = useSettings();
  const { data, isLoading } = useMatchSummary(match.espnId);
  if (isLoading)
    return (
      <div className="modal-tab-loading">
        <div className="spinner" />
      </div>
    );
  const lineup = parseMatchLineup(data, match.team1.espnId);
  if (!lineup) return <p className="modal-tab-empty">{t(lang, "noLineup")}</p>;

  const hasBench = lineup.home.some((p) => !p.starter) || lineup.away.some((p) => !p.starter);

  return (
    <div className="lp-tab">
      <div className="pitch">
        <div className="pitch__label pitch__label--home">
          {match.team1.name.length > 14 ? match.team1.abbr : match.team1.name}
          {lineup.homeFormation && <span className="pitch__formation">{lineup.homeFormation}</span>}
        </div>
        <PitchHalf
          players={lineup.home}
          formation={lineup.homeFormation}
          teamEspnId={match.team1.espnId ?? ""}
          reversed={false}
          onPlayerClick={onPlayerClick}
        />
        <div className="pitch__midline" />
        <PitchHalf
          players={lineup.away}
          formation={lineup.awayFormation}
          teamEspnId={match.team2.espnId ?? ""}
          reversed={true}
          onPlayerClick={onPlayerClick}
        />
        <div className="pitch__label pitch__label--away">
          {match.team2.name.length > 14 ? match.team2.abbr : match.team2.name}
          {lineup.awayFormation && <span className="pitch__formation">{lineup.awayFormation}</span>}
        </div>
      </div>

      {hasBench && (
        <div className="lp-bench">
          <LineupColumn
            title={match.team1.name}
            players={lineup.home.filter((p) => !p.starter).map((p) => ({ ...p, starter: false }))}
            formation={null}
            teamEspnId={match.team1.espnId ?? ""}
            onPlayerClick={onPlayerClick}
          />
          <LineupColumn
            title={match.team2.name}
            players={lineup.away.filter((p) => !p.starter).map((p) => ({ ...p, starter: false }))}
            formation={null}
            teamEspnId={match.team2.espnId ?? ""}
            onPlayerClick={onPlayerClick}
          />
        </div>
      )}
    </div>
  );
}

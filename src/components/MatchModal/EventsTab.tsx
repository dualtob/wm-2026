import { useSettings } from "../../contexts/SettingsContext";
import { useMatchGoals } from "../../hooks/useMatchDetail";
import { t } from "../../i18n";
import { parseMatchEvents } from "../../api/espn-parsers";
import type { Match, EventKind } from "../../types";

function EventIcon({ kind }: { kind: EventKind }) {
  if (kind === "goal" || kind === "ownGoal" || kind === "penalty") {
    return <span className="ev-icon ev-icon--ball" aria-hidden="true">⚽</span>;
  }
  return (
    <span className="ev-icon" aria-hidden="true">
      {(kind === "yellowCard" || kind === "yellowRedCard") && (
        <span className="ev-card ev-card--yellow" />
      )}
      {(kind === "redCard" || kind === "yellowRedCard") && (
        <span className="ev-card ev-card--red" />
      )}
    </span>
  );
}

export default function EventsTab({
  match,
  onPlayerClick,
}: {
  match: Match;
  onPlayerClick?: (id: string, name: string, teamEspnId: string) => void;
}) {
  const { lang } = useSettings();
  const { data, isLoading } = useMatchGoals(match.espnId);
  if (isLoading)
    return (
      <div className="modal-tab-loading">
        <div className="spinner" />
      </div>
    );
  const events = parseMatchEvents(data, match.team1.espnId);
  if (!events.length)
    return <p className="modal-tab-empty">{t(lang, "noEvents")}</p>;

  const homeEspnId = match.team1.espnId ?? "";
  const awayEspnId = match.team2.espnId ?? "";

  return (
    <ul className="ev-timeline">
      {events.map((ev, i) => (
        <li key={i} className={`ev-item ev-item--${ev.side}`}>
          <span className="ev-item__min">{ev.minute}</span>
          <EventIcon kind={ev.kind} />
          <span className="ev-item__player">
            {ev.playerId && onPlayerClick ? (
              <button
                className="ev-player-btn"
                onClick={() =>
                  onPlayerClick(
                    ev.playerId!,
                    ev.player,
                    ev.side === "home" ? homeEspnId : awayEspnId
                  )
                }
              >
                {ev.player}
              </button>
            ) : (
              ev.player
            )}
            {ev.kind === "ownGoal" && <span className="ev-tag">OG</span>}
            {ev.kind === "penalty" && <span className="ev-tag">P</span>}
            {ev.assist && <span className="ev-assist"> · {ev.assist}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

import "./LiveTab.css";
import { useSettings } from "../../contexts/SettingsContext";
import { useLivePlays } from "../../hooks/useLivePlays";
import { t } from "../../i18n";
import { parseLivePlays } from "../../api/espn-parsers";
import type { Match } from "../../types";

export default function LiveTab({ match }: { match: Match }) {
  const { lang } = useSettings();
  const { data, isLoading } = useLivePlays(match.espnId, !!match.isLive);
  if (isLoading)
    return (
      <div className="modal-tab-loading">
        <div className="spinner" />
      </div>
    );
  const plays = parseLivePlays(data, match.team1.espnId);
  if (!plays.length) return <p className="modal-tab-empty">{t(lang, "noEvents")}</p>;
  return (
    <ul className="live-feed">
      {plays.map((p) => (
        <li
          key={p.id}
          className={`live-feed__item${p.scoringPlay ? " live-feed__item--goal" : ""}${
            p.side ? ` live-feed__item--${p.side}` : ""
          }`}
        >
          {p.clock && <span className="live-feed__clock">{p.clock}</span>}
          <span className="live-feed__text">
            {p.scoringPlay && <span className="ev-icon ev-icon--ball" aria-hidden="true">⚽</span>}
            {p.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

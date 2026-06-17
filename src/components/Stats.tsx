import "./Stats.css";
import { useState } from "react";
import FlagIcon from "./FlagIcon";
import { t } from "../i18n";
import { useLeaders } from "../hooks/useLeaders";
import type { Player, Lang } from "../types";

interface PlayerRowProps {
  player: Player;
  rank: number;
  unit: string;
}

function PlayerRow({ player, rank, unit }: PlayerRowProps) {
  const [headshotFailed, setHeadshotFailed] = useState(false);

  return (
    <div className="player-row">
      <span className="player-row__rank">{rank}</span>
      <div className="player-row__avatar">
        {player.headshot && !headshotFailed ? (
          <img
            className="player-row__headshot"
            src={player.headshot}
            alt={player.name}
            width={36}
            height={36}
            loading="lazy"
            onError={() => setHeadshotFailed(true)}
          />
        ) : (
          <FlagIcon team={player.team} size={36} />
        )}
      </div>
      <div className="player-row__info">
        <span className="player-row__name">{player.name}</span>
        <span className="player-row__team">
          {player.team && <FlagIcon team={player.team} size={14} />}
          {player.team}
        </span>
      </div>
      <div className="player-row__stat">
        <span className="player-row__value">{player.value}</span>
        <span className="player-row__unit">{unit}</span>
      </div>
    </div>
  );
}

interface StatsProps {
  lang: Lang;
}

export default function Stats({ lang }: StatsProps) {
  const [activeTab, setActiveTab] = useState<"scorers" | "assists">("scorers");
  const { data: leaders, isLoading, isError } = useLeaders();

  if (isLoading) {
    return (
      <div className="stats-loading">
        <div className="spinner" />
        <p>{t(lang, "statsLoading")}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="stats-error">
        <p className="stats-error__title">{t(lang, "statsError")}</p>
        <p className="stats-error__hint">{t(lang, "statsErrorHint")}</p>
      </div>
    );
  }

  const scorers = leaders?.scorers ?? [];
  const assists = leaders?.assists ?? [];
  const isEmpty = activeTab === "scorers" ? scorers.length === 0 : assists.length === 0;

  return (
    <div className="stats-view">
      <div className="segment-control" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "scorers"}
          className={`segment-btn ${activeTab === "scorers" ? "segment-btn--active" : ""}`}
          onClick={() => setActiveTab("scorers")}
        >
          {t(lang, "statsScorers")}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "assists"}
          className={`segment-btn ${activeTab === "assists" ? "segment-btn--active" : ""}`}
          onClick={() => setActiveTab("assists")}
        >
          {t(lang, "statsAssists")}
        </button>
      </div>

      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-state__content">
            <div className="empty-state__icon">⚽</div>
            <p className="empty-state__text">
              {activeTab === "scorers"
                ? t(lang, "statsEmptyScorers")
                : t(lang, "statsEmptyAssists")}
            </p>
            <p className="empty-state__hint">{t(lang, "statsEmptyHint")}</p>
          </div>
        </div>
      ) : (
        <div className="player-list">
          {(activeTab === "scorers" ? scorers : assists).map((player, idx) => (
            <PlayerRow
              key={player.id || idx}
              player={player}
              rank={idx + 1}
              unit={activeTab === "scorers" ? t(lang, "unitGoals") : t(lang, "unitAssists")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

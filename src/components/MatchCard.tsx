import "./MatchCard.css";
import { useEffect, useRef, useState, useCallback } from "react";
import FlagIcon from "./FlagIcon";
import { t } from "../i18n";
import type { Match, Lang } from "../types";
import { TZ } from "../constants";
import { useMatchOdds } from "../hooks/useMatchOdds";
import type { MarketOdds } from "../types";

interface MatchCardProps {
  match: Match;
  lang: Lang;
  onTeamClick?: (name: string) => void;
  onMatchClick?: (match: Match) => void;
  myTeams?: string[];
}

const dateKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

function getCountdown(kickoff: Date): string | null {
  const diffMs = kickoff.getTime() - Date.now();
  if (diffMs <= 0 || diffMs > 12 * 60 * 60 * 1000) return null;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return null;
  if (diffMins < 60) return `in ${diffMins}m`;
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

function useCountdown(kickoff: Date | null, enabled: boolean): string | null {
  const [label, setLabel] = useState<string | null>(() =>
    enabled && kickoff ? getCountdown(kickoff) : null
  );
  const update = useCallback(() => {
    setLabel(enabled && kickoff ? getCountdown(kickoff) : null);
  }, [kickoff, enabled]);
  useEffect(() => {
    if (!enabled || !kickoff) return;
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [kickoff, enabled, update]);
  return label;
}

function getTodayKey(): string {
  return dateKeyFmt.format(new Date());
}

function getDateKey(date: Date): string {
  return dateKeyFmt.format(date);
}

function formatKickoff(date: Date, lang: Lang, isToday: boolean): string {
  const locale = lang === "de" ? "de-DE" : lang === "en" ? "en-US" : "es-ES";
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return isToday ? `${t(lang, "relToday")} ${time}` : time;
}

function parseMatchProbs(
  odds: MarketOdds | null | undefined,
  team1Name: string,
  team2Name: string
): { home: number; draw: number; away: number } | null {
  if (!odds?.outcomes?.length) return null;
  const t1 = team1Name.toLowerCase();
  const t2 = team2Name.toLowerCase();
  let home: number | null = null;
  let draw: number | null = null;
  let away: number | null = null;
  for (const o of odds.outcomes) {
    const label = o.outcome.toLowerCase();
    if (label === "draw" || label === "tie") draw = o.probability;
    else if (label.includes(t1) || label === "home") home = o.probability;
    else if (label.includes(t2) || label === "away") away = o.probability;
  }
  if (home === null && away === null) return null;
  const total = (home ?? 0) + (draw ?? 0) + (away ?? 0);
  if (total === 0) return null;
  const scale = 1 / total;
  return { home: (home ?? 0) * scale, draw: (draw ?? 0) * scale, away: (away ?? 0) * scale };
}

function OddsBar({
  home,
  draw,
  away,
}: {
  home: number;
  draw: number;
  away: number;
}) {
  const fmt = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="match-card__odds" aria-label={`Win probability: home ${fmt(home)}, draw ${fmt(draw)}, away ${fmt(away)}`}>
      <span className="match-card__odds-pct">{fmt(home)}</span>
      <div className="match-card__odds-bar">
        <div className="match-card__odds-seg match-card__odds-seg--home" style={{ flex: home }} />
        {draw > 0 && <div className="match-card__odds-seg match-card__odds-seg--draw" style={{ flex: draw }} />}
        <div className="match-card__odds-seg match-card__odds-seg--away" style={{ flex: away }} />
      </div>
      <span className="match-card__odds-pct match-card__odds-pct--away">{fmt(away)}</span>
    </div>
  );
}

export default function MatchCard({
  match,
  lang,
  onTeamClick,
  onMatchClick,
  myTeams = [],
}: MatchCardProps) {
  const { team1, team2, score, played, isLive, liveMinute, kickoff, group, stage, matchday, isPenalties } =
    match;

  const isMyMatch = myTeams.includes(team1.name) || myTeams.includes(team2.name);
  const isToday = !!kickoff && getDateKey(kickoff) === getTodayKey();
  const team1Lost = played && !isLive && score !== null && score.home < score.away;
  const team2Lost = played && !isLive && score !== null && score.away < score.home;
  const countdown = useCountdown(kickoff, isToday && !isLive && !played);
  const showOdds = isToday && !isLive && !played;

  const { data: oddsData } = useMatchOdds(team1.name, team2.name, showOdds);
  const probs = showOdds ? parseMatchProbs(oddsData as MarketOdds | null, team1.name, team2.name) : null;

  // Pulse the side whose score just increased
  const prev = useRef(score);
  const [flash, setFlash] = useState<"home" | "away" | null>(null);
  useEffect(() => {
    if (!score) {
      prev.current = score;
      return;
    }
    const p = prev.current;
    if (p && score.home > p.home) setFlash("home");
    else if (p && score.away > p.away) setFlash("away");
    prev.current = score;
    if (flash) {
      const id = setTimeout(() => setFlash(null), 900);
      return () => clearTimeout(id);
    }
  }, [score, flash]);

  const statusLabel = isLive
    ? liveMinute || t(lang, "live")
    : played
    ? isPenalties
      ? t(lang, "penalties")
      : t(lang, "final")
    : null;

  const stageLabel = group
    ? `${group}${matchday ? ` · ${t(lang, "matchdayAbbr")}${matchday}` : ""}`
    : stage;

  const scoreLabel =
    (isLive || played) && score != null
      ? `${score.home}–${score.away}`
      : kickoff
      ? formatKickoff(kickoff, lang, isToday)
      : "";

  return (
    <article
      className={`match-card${isLive ? " match-card--live" : ""}${played && !isLive ? " match-card--played" : ""}${isMyMatch ? " match-card--mine" : ""}`}
    >
      {/* Invisible full-card button for the primary action (open match detail).
          Sits behind team buttons so team clicks reach their own handlers. */}
      <button
        className="match-card__overlay"
        onClick={() => onMatchClick?.(match)}
        aria-label={`${team1.name} vs ${team2.name}${scoreLabel ? `, ${scoreLabel}` : ""}`}
      />

      {stageLabel && <div className="match-card__stage">{stageLabel}</div>}

      <div className="match-card__body">
        <button
          className={`match-card__team${team1Lost ? " match-card__team--lost" : ""}`}
          onClick={() => onTeamClick?.(team1.name)}
          aria-label={team1.name}
        >
          <FlagIcon team={team1.name} size={28} />
          <span className="match-card__team-name">
            <span className="match-card__abbr">{team1.abbr}</span>
            <span className="match-card__fullname">{team1.name}</span>
          </span>
        </button>

        <div className="match-card__center">
          {(isLive || played) && score !== null && score !== undefined ? (
            <div className="match-card__score">
              <span
                className={`match-card__score-num${score.home > score.away ? " match-card__score-num--win" : ""}${flash === "home" ? " match-card__score-num--flash" : ""}`}
              >
                {score.home}
              </span>
              <span className="match-card__score-sep">–</span>
              <span
                className={`match-card__score-num${score.away > score.home ? " match-card__score-num--win" : ""}${flash === "away" ? " match-card__score-num--flash" : ""}`}
              >
                {score.away}
              </span>
            </div>
          ) : (
            <div className={`match-card__time${isToday ? " match-card__time--today" : ""}`}>
              {kickoff ? formatKickoff(kickoff, lang, isToday) : "TBD"}
              {countdown && <span className="match-card__countdown">{countdown}</span>}
            </div>
          )}
          {statusLabel && (
            <div className={`match-card__status${isLive ? " match-card__status--live" : ""}`}>
              {isLive && <span className="live-dot" aria-hidden="true" />}
              {statusLabel}
            </div>
          )}
        </div>

        <button
          className={`match-card__team match-card__team--right${team2Lost ? " match-card__team--lost" : ""}`}
          onClick={() => onTeamClick?.(team2.name)}
          aria-label={team2.name}
        >
          <span className="match-card__team-name">
            <span className="match-card__abbr">{team2.abbr}</span>
            <span className="match-card__fullname">{team2.name}</span>
          </span>
          <FlagIcon team={team2.name} size={28} />
        </button>
      </div>

      {probs && (
        <OddsBar home={probs.home} draw={probs.draw} away={probs.away} />
      )}

      {match.venue && (
        <div className="match-card__venue">
          {match.venue}
          {match.city ? `, ${match.city}` : ""}
        </div>
      )}

      {typeof navigator !== "undefined" && "share" in navigator && (
        <button
          className="match-card__share"
          aria-label="Share"
          onClick={(e) => {
            e.stopPropagation();
            const text = played && score
              ? `${team1.name} ${score.home}–${score.away} ${team2.name}`
              : kickoff
              ? `${team1.name} vs ${team2.name} · ${formatKickoff(kickoff, lang, false)}`
              : `${team1.name} vs ${team2.name}`;
            navigator.share({ title: "World Cup 2026", text }).catch(() => {});
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      )}
    </article>
  );
}

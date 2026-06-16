import { useCallback } from "react";
import FlagIcon from "./FlagIcon";
import { CloseIcon } from "./MatchModal";
import { usePlayerProfile } from "../hooks/usePlayerProfile";
import { useSettings } from "../contexts/SettingsContext";
import { t } from "../i18n";
import { ESPN_CDN_URL } from "../constants";
import { TEAMS } from "../teams";
import type { PlayerProfile } from "../types";

// ─── Parser ─────────────────────────────────────────────────────────────────

type RawSeasonStat = {
  name?: string;
  displayName?: string;
  displayValue?: string;
};

type RawCategory = {
  name?: string;
  stats?: RawSeasonStat[];
};

type RawAthlete = {
  id?: string | number;
  displayName?: string;
  fullName?: string;
  age?: number;
  position?: { displayName?: string; abbreviation?: string };
  citizenship?: string;
  citizenshipCountry?: { name?: string };
  birthPlace?: { country?: string };
  team?: { id?: string; displayName?: string; abbreviation?: string };
  headshot?: { href?: string };
};

type RawOverview = {
  athlete?: RawAthlete;
  team?: { id?: string; displayName?: string };
  statistics?: { categories?: RawCategory[] } | { splits?: { categories?: RawCategory[] } };
};

function findStat(categories: RawCategory[] | undefined, names: string[]): string | null {
  for (const cat of categories ?? []) {
    for (const s of cat.stats ?? []) {
      const key = (s.name ?? "").toLowerCase();
      const disp = (s.displayName ?? "").toLowerCase();
      if (names.some((n) => key === n.toLowerCase() || disp === n.toLowerCase())) {
        return s.displayValue ?? null;
      }
    }
  }
  return null;
}

function findEspnIdToTeamName(espnId: string | undefined): string {
  if (!espnId) return "";
  for (const [name, data] of Object.entries(TEAMS)) {
    if (data.espnId === espnId) return name;
  }
  return "";
}

function parseProfile(data: unknown): PlayerProfile | null {
  const d = data as RawOverview;
  const a = d?.athlete;
  if (!a) return null;
  const teamEspnId = String(a.team?.id ?? d.team?.id ?? "");
  return {
    id: String(a.id ?? ""),
    name: String(a.displayName ?? a.fullName ?? "?"),
    team: findEspnIdToTeamName(teamEspnId) || String(a.team?.displayName ?? d.team?.displayName ?? ""),
    teamEspnId,
    position: String(a.position?.displayName ?? a.position?.abbreviation ?? ""),
    age: a.age ?? null,
    nationality: a.citizenship ?? a.citizenshipCountry?.name ?? a.birthPlace?.country ?? null,
    headshot: a.headshot?.href ?? (a.id ? `${ESPN_CDN_URL}/${a.id}.png` : null),
    club: null,
  };
}

interface SeasonStats {
  goals: string | null;
  assists: string | null;
  cards: string | null;
  apps: string | null;
}

function parseSeasonStats(data: unknown): SeasonStats {
  const d = data as RawOverview;
  let categories: RawCategory[] | undefined;
  if (d?.statistics && "categories" in d.statistics) {
    categories = d.statistics.categories;
  } else if (d?.statistics && "splits" in d.statistics) {
    categories = d.statistics.splits?.categories;
  }
  return {
    goals: findStat(categories, ["totalGoals", "goals", "G"]),
    assists: findStat(categories, ["goalAssists", "assists", "A"]),
    cards: findStat(categories, ["totalYellowCards", "yellowCards", "YC"]),
    apps: findStat(categories, ["appearances", "gamesPlayed", "GP", "Apps"]),
  };
}

// ─── Sheet ──────────────────────────────────────────────────────────────────

interface PlayerSheetProps {
  playerId: string;
  fallbackName: string;
  fallbackTeamEspnId: string;
  onClose: () => void;
}

export default function PlayerSheet({
  playerId,
  fallbackName,
  fallbackTeamEspnId,
  onClose,
}: PlayerSheetProps) {
  const { lang } = useSettings();
  const { data, isLoading } = usePlayerProfile(playerId);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const profile = parseProfile(data);
  const stats = parseSeasonStats(data);
  const teamName =
    profile?.team || findEspnIdToTeamName(fallbackTeamEspnId);
  const displayName = profile?.name ?? fallbackName;
  const headshot = profile?.headshot ?? `${ESPN_CDN_URL}/${playerId}.png`;

  return (
    <div className="sheet-backdrop" onClick={handleBackdrop} role="dialog" aria-modal="true" aria-label={displayName}>
      <div className="player-sheet">
        <button className="sheet-close-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>

        <div className="player-sheet__hero">
          {headshot && (
            <img
              src={headshot}
              alt={displayName}
              className="player-sheet__photo"
              width={88}
              height={88}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="player-sheet__info">
            <h2 className="player-sheet__name">{displayName}</h2>
            {teamName && (
              <div className="player-sheet__team">
                <FlagIcon team={teamName} size={16} />
                <span>{teamName}</span>
              </div>
            )}
            {profile?.position && (
              <span className="player-sheet__pos">{profile.position}</span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="modal-tab-loading">
            <div className="spinner" />
          </div>
        ) : (
          <>
            <div className="player-sheet__stats">
              {stats.goals !== null && (
                <div className="player-sheet__stat">
                  <span className="player-sheet__stat-val">{stats.goals}</span>
                  <span className="player-sheet__stat-label">{t(lang, "playerGoals")}</span>
                </div>
              )}
              {stats.assists !== null && (
                <div className="player-sheet__stat">
                  <span className="player-sheet__stat-val">{stats.assists}</span>
                  <span className="player-sheet__stat-label">{t(lang, "playerAssists")}</span>
                </div>
              )}
              {stats.cards !== null && (
                <div className="player-sheet__stat">
                  <span className="player-sheet__stat-val">{stats.cards}</span>
                  <span className="player-sheet__stat-label">{t(lang, "playerCards")}</span>
                </div>
              )}
              {stats.apps !== null && (
                <div className="player-sheet__stat">
                  <span className="player-sheet__stat-val">{stats.apps}</span>
                  <span className="player-sheet__stat-label">{t(lang, "playerApps")}</span>
                </div>
              )}
            </div>

            <div className="player-sheet__meta">
              {profile?.age !== null && profile?.age !== undefined && (
                <div className="player-sheet__meta-row">
                  <span>{t(lang, "playerAge")}</span>
                  <span>{profile.age}</span>
                </div>
              )}
              {profile?.nationality && (
                <div className="player-sheet__meta-row">
                  <span>{t(lang, "playerNat")}</span>
                  <span>{profile.nationality}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

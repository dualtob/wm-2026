import { useState } from "react";
import { getFlagCode, getTeamColor, getTeam } from "../teams";

interface FlagIconProps {
  team: string;
  size?: number;
  className?: string;
}

function getInitials(team: string): string {
  const data = getTeam(team);
  if (data?.abbr) return data.abbr.slice(0, 2);
  return team
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

export default function FlagIcon({ team, size = 24, className = "" }: FlagIconProps) {
  const [failed, setFailed] = useState(false);
  const code = getFlagCode(team);
  const url = `https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags/${code}.svg`;

  if (failed) {
    return (
      <span
        className={`flag-icon flag-icon--fallback ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(8, Math.round(size * 0.4)),
          background: getTeamColor(team),
        }}
        aria-label={team}
      >
        {getInitials(team)}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={team}
      width={size}
      height={size}
      className={`flag-icon ${className}`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

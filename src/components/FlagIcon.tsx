import { getFlagCode } from "../teams";

interface FlagIconProps {
  team: string;
  size?: number;
  className?: string;
}

export default function FlagIcon({ team, size = 24, className = "" }: FlagIconProps) {
  const code = getFlagCode(team);
  const url = `https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags/${code}.svg`;

  return (
    <img
      src={url}
      alt={team}
      width={size}
      height={size}
      className={`flag-icon ${className}`}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
      loading="lazy"
    />
  );
}

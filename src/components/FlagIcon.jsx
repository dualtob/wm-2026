import { getFlagCode } from "../teams.js";

// Renders a circular flag from the HatScripts circle-flags CDN
export default function FlagIcon({ team, size = 24, className = "" }) {
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
        // Fallback: hide broken flag
        e.currentTarget.style.display = "none";
      }}
      loading="lazy"
    />
  );
}

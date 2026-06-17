import "./TeamPicker.css";
import { useState, useMemo } from "react";
import FlagIcon from "./FlagIcon";
import { useSettings } from "../contexts/SettingsContext";
import { t } from "../i18n";
import type { Match } from "../types";

interface TeamPickerProps {
  matches: Match[];
}

export default function TeamPicker({ matches }: TeamPickerProps) {
  const { lang, myTeams, toggleMyTeam } = useSettings();
  const [query, setQuery] = useState("");

  const allTeams = useMemo(
    () =>
      Array.from(
        new Set(
          matches
            .filter((m) => !m.isPlaceholder)
            .flatMap((m) => [m.team1.name, m.team2.name])
            .filter(Boolean)
        )
      ).sort(),
    [matches]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTeams;
    return allTeams.filter((n) => n.toLowerCase().includes(q));
  }, [allTeams, query]);

  return (
    <>
      <div className="team-picker__search">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="16"
          height="16"
          className="team-picker__search-icon"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          className="team-picker__input"
          placeholder={t(lang, "searchTeams")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button
            className="team-picker__clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
      <div className="team-picker">
        {visible.map((name) => (
          <button
            key={name}
            className={`team-pick-btn ${myTeams.includes(name) ? "team-pick-btn--active" : ""}`}
            onClick={() => toggleMyTeam(name)}
          >
            <FlagIcon team={name} size={20} />
            <span>{name}</span>
          </button>
        ))}
        {visible.length === 0 && (
          <p className="team-picker__empty">{t(lang, "searchNoResults")}</p>
        )}
      </div>
    </>
  );
}

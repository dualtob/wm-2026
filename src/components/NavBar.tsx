import { t } from "../i18n";
import type { Lang } from "../types";

type TabId = "upcoming" | "calendar" | "groups" | "stats";

interface NavBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  lang: Lang;
  liveCount?: number;
}

const TABS: Array<{ id: TabId; labelKey: Parameters<typeof t>[1]; icon: React.ReactNode }> = [
  {
    id: "upcoming",
    labelKey: "navUpcoming",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: "calendar",
    labelKey: "navCalendar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "groups",
    labelKey: "navGroups",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    id: "stats",
    labelKey: "navStats",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

export default function NavBar({ activeTab, onTabChange, lang, liveCount = 0 }: NavBarProps) {
  return (
    <nav className="nav-bar" role="tablist" aria-label="Main navigation">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          className={`nav-tab ${activeTab === tab.id ? "nav-tab--active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="nav-tab__icon">
            {tab.icon}
            {tab.id === "upcoming" && liveCount > 0 && (
              <span className="nav-tab__live-badge" aria-label={`${liveCount} live`} />
            )}
          </span>
          <span className="nav-tab__label">{t(lang, tab.labelKey)}</span>
        </button>
      ))}
    </nav>
  );
}

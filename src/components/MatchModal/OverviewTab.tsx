import { useSettings } from "../../contexts/SettingsContext";
import { t } from "../../i18n";
import { TZ } from "../../constants";
import type { Match } from "../../types";

export default function OverviewTab({ match, locale }: { match: Match; locale: string }) {
  const { lang } = useSettings();
  return (
    <div className="match-modal__meta">
      {match.stage && (
        <div className="match-modal__meta-row">
          <span className="match-modal__meta-label">{t(lang, "detailStage")}</span>
          <span>{match.stage}</span>
        </div>
      )}
      {match.venue && (
        <div className="match-modal__meta-row">
          <span className="match-modal__meta-label">{t(lang, "detailVenue")}</span>
          <span>
            {match.venue}
            {match.city ? `, ${match.city}` : ""}
          </span>
        </div>
      )}
      {match.kickoff && (
        <div className="match-modal__meta-row">
          <span className="match-modal__meta-label">{t(lang, "detailDateTime")}</span>
          <span>
            {new Intl.DateTimeFormat(locale, {
              timeZone: TZ,
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(match.kickoff)}
          </span>
        </div>
      )}
    </div>
  );
}

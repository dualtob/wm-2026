import "./SettingsModal.css";
import { useSettings, LANGS, LANG_LABELS } from "../contexts/SettingsContext";
import { t } from "../i18n";
import { CloseIcon } from "./MatchModal";
import TeamPicker from "./TeamPicker";
import { useWorldCupData } from "../hooks/useWorldCupData";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { lang, handleLangChange, myTeams, clearMyTeams } = useSettings();
  const { matches } = useWorldCupData();

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="settings-modal">
        <div className="settings-modal__header">
          <h2>{t(lang, "language")}</h2>
          <button className="sheet-close-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="lang-options">
          {LANGS.map((l) => (
            <button
              key={l}
              className={`lang-option ${lang === l ? "lang-option--active" : ""}`}
              onClick={() => {
                handleLangChange(l);
                onClose();
              }}
            >
              {LANG_LABELS[l]}
              {lang === l && <span className="lang-option__check">✓</span>}
            </button>
          ))}
        </div>

        <hr className="settings-divider" />

        <div className="settings-section">
          <div className="settings-section__header">
            <h3>{t(lang, "selTitle")}</h3>
            {myTeams.length > 0 && (
              <button className="link-btn" onClick={clearMyTeams}>
                {t(lang, "selClearAll")}
              </button>
            )}
          </div>
          <p className="settings-hint">
            {myTeams.length} {t(lang, "selFollowed")} · {t(lang, "selToggleHint")}
          </p>
          <TeamPicker matches={matches} />
        </div>

        <button className="btn btn--primary settings-done-btn" onClick={onClose}>
          {t(lang, "selDone")}
        </button>
      </div>
    </div>
  );
}

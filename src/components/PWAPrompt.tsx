import { usePWA } from "../hooks/usePWA";
import { useSettings } from "../contexts/SettingsContext";
import { t } from "../i18n";

export default function PWAPrompt() {
  const { lang } = useSettings();
  const { showUpdate, updateServiceWorker, showInstallAndroid, install, showInstallIOS, dismiss } =
    usePWA();

  // Priority: update > android install > iOS hint
  if (!showUpdate && !showInstallAndroid && !showInstallIOS) return null;

  return (
    <div className="pwa-prompt" role="status">
      {showUpdate ? (
        <div className="pwa-prompt__inner">
          <span className="pwa-prompt__icon">🔄</span>
          <span className="pwa-prompt__text">{t(lang, "pwaUpdate")}</span>
          <button className="pwa-prompt__action" onClick={() => updateServiceWorker()}>
            {t(lang, "pwaUpdateBtn")}
          </button>
          <button className="pwa-prompt__close" onClick={dismiss} aria-label="Dismiss">✕</button>
        </div>
      ) : showInstallAndroid ? (
        <div className="pwa-prompt__inner">
          <span className="pwa-prompt__icon">📲</span>
          <span className="pwa-prompt__text">{t(lang, "pwaInstall")}</span>
          <button className="pwa-prompt__action" onClick={install}>
            {t(lang, "pwaInstallBtn")}
          </button>
          <button className="pwa-prompt__close" onClick={dismiss} aria-label="Dismiss">✕</button>
        </div>
      ) : (
        <div className="pwa-prompt__inner pwa-prompt__inner--ios">
          <span className="pwa-prompt__text">{t(lang, "pwaIOSHint")}</span>
          <button className="pwa-prompt__close" onClick={dismiss} aria-label="Dismiss">✕</button>
        </div>
      )}
    </div>
  );
}

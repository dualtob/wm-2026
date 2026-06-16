import { useState, useEffect } from "react";
import { usePWA } from "../hooks/usePWA";
import { useSettings } from "../contexts/SettingsContext";
import { t } from "../i18n";

export default function PWAPrompt() {
  const { lang } = useSettings();
  const { showUpdate, updateServiceWorker, showInstallAndroid, install, showInstallIOS, dismiss } =
    usePWA();

  // Priority: update > android install > iOS hint
  const visible = showUpdate || showInstallAndroid || showInstallIOS;
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(visible);

  // Sync mounted with visible, but defer unmount until the slide-out animation ends
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setLeaving(false);
    } else if (mounted) {
      setLeaving(true);
      const id = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(id);
    }
  }, [visible, mounted]);

  if (!mounted) return null;

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(dismiss, 240);
  };

  const wrapperClass = `pwa-prompt${leaving ? " pwa-prompt--leaving" : ""}`;

  return (
    <div className={wrapperClass} role="status">
      {showUpdate ? (
        <div className="pwa-prompt__inner">
          <span className="pwa-prompt__icon">🔄</span>
          <span className="pwa-prompt__text">{t(lang, "pwaUpdate")}</span>
          <button className="pwa-prompt__action" onClick={() => updateServiceWorker()}>
            {t(lang, "pwaUpdateBtn")}
          </button>
          <button className="pwa-prompt__close" onClick={handleDismiss} aria-label="Dismiss">✕</button>
        </div>
      ) : showInstallAndroid ? (
        <div className="pwa-prompt__inner">
          <span className="pwa-prompt__icon">📲</span>
          <span className="pwa-prompt__text">{t(lang, "pwaInstall")}</span>
          <button className="pwa-prompt__action" onClick={install}>
            {t(lang, "pwaInstallBtn")}
          </button>
          <button className="pwa-prompt__close" onClick={handleDismiss} aria-label="Dismiss">✕</button>
        </div>
      ) : showInstallIOS ? (
        <div className="pwa-prompt__inner pwa-prompt__inner--ios">
          <span className="pwa-prompt__text">{t(lang, "pwaIOSHint")}</span>
          <button className="pwa-prompt__close" onClick={handleDismiss} aria-label="Dismiss">✕</button>
        </div>
      ) : null}
    </div>
  );
}

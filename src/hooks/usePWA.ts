import { useState, useEffect } from "react";
import { lsGet, lsSet } from "../utils/storage";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "wc2026:pwa:dismissed";
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function wasDismissedRecently(): boolean {
  const ts = lsGet(DISMISSED_KEY);
  if (!ts) return false;
  return Date.now() - parseInt(ts) < DISMISS_TTL;
}

function isIOSSafari(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !("MSStream" in window) &&
    !navigator.userAgent.includes("Chrome")
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(wasDismissedRecently);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  // Detect new SW via native Service Worker API — avoids virtual:pwa-register
  // dependency which Rolldown cannot resolve in some environments.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setNeedsRefresh(true);
            }
          });
        });
      })
      .catch(() => {
        // SW not available or blocked
      });
  }, []);

  // Capture beforeinstallprompt (Android / Chrome / Edge)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    setInstallPrompt(null);
    lsSet(DISMISSED_KEY, Date.now().toString());
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  return {
    showUpdate: needsRefresh,
    updateServiceWorker: () => window.location.reload(),
    showInstallAndroid: !!installPrompt && !dismissed,
    install,
    showInstallIOS: isIOSSafari() && !isStandalone() && !dismissed,
    dismiss,
  };
}

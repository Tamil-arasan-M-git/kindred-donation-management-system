import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/client";
import "./PWAStatus.css";

export default function PWAStatus() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installEvent, setInstallEvent] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("kindred_install_dismissed") === "1");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const handleUpdate = () => setUpdateAvailable(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstall);
    window.addEventListener("kindred-sw-update", handleUpdate);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstall);
      window.removeEventListener("kindred-sw-update", handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (authLoading || !user || !online) return undefined;
    let active = true;
    setSyncing(true);
    api.sync.check().catch(() => {}).finally(() => {
      if (active) setSyncing(false);
    });
    return () => { active = false; };
  }, [authLoading, online, user]);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  };

  const dismissInstall = () => {
    localStorage.setItem("kindred_install_dismissed", "1");
    setDismissed(true);
  };

  const refresh = () => window.location.reload();

  return (
    <div className="pwa-status-stack" aria-live="polite">
      {!online ? (
        <div className="pwa-status-banner offline" role="status">
          <i className="fi fi-rr-wifi-slash" aria-hidden="true" />
          <span>{t("pwa.offline", { defaultValue: "You're offline. Showing your last available data." })}</span>
        </div>
      ) : null}
      {online && updateAvailable ? (
        <div className="pwa-status-banner update" role="status">
          <span>{t("pwa.updateAvailable", { defaultValue: "A new version of Kindred is available." })}</span>
          <button type="button" onClick={refresh}>{t("pwa.refresh", { defaultValue: "Refresh" })}</button>
        </div>
      ) : null}
      {online && syncing ? (
        <div className="pwa-status-banner syncing" role="status">
          <span>{t("pwa.updating", { defaultValue: "Updating your latest data..." })}</span>
        </div>
      ) : null}
      {online && installEvent && !dismissed ? (
        <div className="pwa-status-banner install" role="status">
          <span>{t("pwa.install", { defaultValue: "Install Kindred for quicker access." })}</span>
          <button type="button" onClick={install}>{t("pwa.installAction", { defaultValue: "Install" })}</button>
          <button type="button" className="quiet" onClick={dismissInstall}>{t("pwa.notNow", { defaultValue: "Not now" })}</button>
        </div>
      ) : null}
    </div>
  );
}

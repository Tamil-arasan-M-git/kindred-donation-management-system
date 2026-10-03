import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (registration.waiting) {
        window.dispatchEvent(new Event("kindred-sw-update"));
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new Event("kindred-sw-update"));
          }
        });
      });
    }).catch(() => {
      // The application remains fully usable when service-worker registration is unavailable.
    });
  });
}

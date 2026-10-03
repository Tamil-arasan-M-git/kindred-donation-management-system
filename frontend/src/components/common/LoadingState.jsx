import { useTranslation } from "react-i18next";
import { SkeletonLayout } from "./Skeleton";

export default function LoadingState({ message, variant = "dashboard" }) {
  const { t } = useTranslation();
  const path = window.location.pathname;
  const inferredVariant = variant !== "dashboard" ? variant :
    path === "/admin" ? "dashboard" :
    path.startsWith("/admin/") ? "admin-table" :
    path === "/ngo" || path === "/donor" ? "dashboard" :
    path.includes("/donations/") ? "detail" :
    path.endsWith("/donations") ? "donations" :
    path.includes("/matches") ? "matches" :
    path.endsWith("/pickup") ? "pickup" :
    path.endsWith("/profile") ? "profile" :
    path.endsWith("/demands") ? "table" :
    path.endsWith("/operations") ? "operations" :
    path.endsWith("/staff") ? "staff" : "dashboard";
  return (
    <div
      className={`loading-state-region loading-state-${inferredVariant}`}
      role="status"
      aria-busy="true"
      aria-label={message || t("common.loading")}
    >
      <SkeletonLayout variant={inferredVariant} />
    </div>
  );
}

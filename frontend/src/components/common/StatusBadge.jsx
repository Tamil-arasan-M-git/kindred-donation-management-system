import { useTranslation } from "react-i18next";
import { STATUS_CLASS } from "../../utils/status";

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const statusClass = STATUS_CLASS[status] || "status-submitted";
  return (
    <span className={`status-pill ${statusClass}`}>
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

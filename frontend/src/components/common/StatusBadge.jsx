import { getStatusLabel, STATUS_CLASS } from "../../utils/status";

export default function StatusBadge({ status }) {
  const statusClass = STATUS_CLASS[status] || "status-submitted";
  return (
    <span className={`status-pill ${statusClass}`}>
      {getStatusLabel(status)}
    </span>
  );
}

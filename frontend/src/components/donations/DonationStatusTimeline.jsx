import StatusBadge from "../common/StatusBadge";
import { getStatusLabel } from "../../utils/status";

const STATUS_ORDER = [
  "submitted",
  "matched",
  "packaging_notified",
  "pickup_scheduled",
  "collected",
  "delivered",
  "acknowledged",
];

export default function DonationStatusTimeline({ status, history = [] }) {
  if (status === "cancelled") {
    return (
      <div className="donation-timeline">
        <div className="timeline-step timeline-step-current">
          <span className="timeline-dot">•</span>
          <div><StatusBadge status="cancelled" /><small>Donation cancelled</small></div>
        </div>
      </div>
    );
  }

  const currentIndex = STATUS_ORDER.indexOf(status);
  const historyByStatus = new Map(
    history.map((event) => [event.new_status, event]),
  );

  return (
    <div className="donation-timeline">
      {STATUS_ORDER.map((step, index) => {
        const complete = currentIndex >= index;
        const event = historyByStatus.get(step);
        return (
          <div
            key={step}
            className={`timeline-step ${complete ? "timeline-step-complete" : ""} ${currentIndex === index ? "timeline-step-current" : ""}`}
          >
            <span className="timeline-dot">{complete ? "✓" : "○"}</span>
            <div>
              <strong>{getStatusLabel(step)}</strong>
              {event?.changed_at ? (
                <small>{new Date(event.changed_at).toLocaleString()}</small>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

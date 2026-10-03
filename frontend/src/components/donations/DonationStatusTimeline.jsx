import StatusBadge from "../common/StatusBadge";
import { useTranslation } from "react-i18next";
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

const STATUS_ICONS = {
  submitted: "document",
  matched: "users-alt",
  packaging_notified: "box-open",
  pickup_scheduled: "truck-side",
  collected: "box",
  delivered: "home",
  acknowledged: "check-circle",
  cancelled: "ban",
};

export default function DonationStatusTimeline({ status, history = [] }) {
  const { t, i18n } = useTranslation();
  if (status === "cancelled") {
    return (
      <div className="donation-timeline">
        <div className="timeline-step timeline-step-current timeline-step-cancelled">
          <span className="timeline-dot">
            <i
              className={`fi fi-rr-${STATUS_ICONS.cancelled}`}
              aria-hidden="true"
            />
          </span>
          <div>
            <StatusBadge status="cancelled" />
            <small>{t("donor.journey.donationCancelled")}</small>
          </div>
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
            <span className="timeline-dot">
              <i
                className={`fi fi-rr-${STATUS_ICONS[step]}`}
                aria-hidden="true"
              />
            </span>
            <div>
              <strong>
                {t(`status.${step}`, { defaultValue: getStatusLabel(step) })}
              </strong>
              {event?.changed_at ? (
                <small>
                  {new Date(event.changed_at).toLocaleString(
                    i18n.resolvedLanguage,
                  )}
                </small>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

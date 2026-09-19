export const STATUS_LABELS = {
  candidate: "Candidate",
  recommended: "Recommended",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  submitted: "Submitted",
  matched: "Matched",
  packaging_notified: "Packaging Notified",
  pickup_scheduled: "Pickup Scheduled",
  collected: "Collected",
  delivered: "Delivered",
  acknowledged: "Acknowledged",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
};

export const STATUS_CLASS = {
  submitted: "status-submitted",
  matched: "status-matched",
  packaging_notified: "status-packaging",
  pickup_scheduled: "status-pickup",
  collected: "status-collected",
  delivered: "status-delivered",
  acknowledged: "status-acknowledged",
  cancelled: "status-cancelled",
};

export const getStatusLabel = (status) =>
  STATUS_LABELS[status] || status || "Unknown";

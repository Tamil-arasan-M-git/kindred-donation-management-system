import { Link } from "react-router-dom";

export default function DonationActions({ donation }) {
  if (!donation) return null;

  if (donation.status === "matched") {
    return <Link className="secondary-button" to={`/donor/donations/${donation.id}#packaging`}>View packaging checklist</Link>;
  }
  if (donation.status === "packaging_notified") {
    return <Link className="secondary-button" to={`/donor/donations/${donation.id}#pickup`}>Schedule pickup</Link>;
  }
  if (["pickup_scheduled", "collected", "delivered"].includes(donation.status)) {
    return <Link className="secondary-button" to="/donor/pickup">View pickup</Link>;
  }
  return null;
}

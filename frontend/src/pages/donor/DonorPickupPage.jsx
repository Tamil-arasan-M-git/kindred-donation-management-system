import { useEffect, useState } from "react";
import api from "../../api/client";
import StatusBadge from "../../components/common/StatusBadge";
import DonorShell from "./DonorShell";
import PageHeader from "../../components/layout/PageHeader";
import LoadingState from "../../components/common/LoadingState";
import ErrorMessage from "../../components/common/ErrorMessage";
import { Link } from "react-router-dom";

export default function DonorPickupPage() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/donations")
      .then(setDonations)
      .catch((err) =>
        setError(err.message || "Pickup information could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, []);

  const pickupDonations = donations.filter((donation) =>
    ["matched", "packaging_notified", "pickup_scheduled", "collected", "delivered", "acknowledged"].includes(donation.status),
  );

  return (
    <DonorShell>
      <PageHeader eyebrow="Pickup" title="Pickup schedule" description="Schedule and track collection for matched donations." />
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {loading ? <LoadingState message="Loading pickup information..." /> : null}
      {!loading && !error && !pickupDonations.length ? (
        <div className="empty-state">
          <h2>No pickup has been scheduled yet.</h2>
          <p>
            Pickup information will appear once a donation reaches the
            appropriate stage.
          </p>
        </div>
      ) : null}
      {pickupDonations.map((donation) => (
        <div className="info-card wide-card" key={donation.id}>
          <h2>Donation #{donation.id.slice(0, 8).toUpperCase()}</h2>
          <p>
            {donation.items
              .map((item) => `${item.class_name} x${item.quantity}`)
              .join(", ")}
          </p>
          <p>Current progress: <StatusBadge status={donation.status} /></p>
          {donation.status === "pickup_scheduled" ? <p>Pickup: {donation.pickup_scheduled_at ? new Date(donation.pickup_scheduled_at).toLocaleString() : "Scheduled time confirmed by backend"}</p> : null}
          {donation.status === "collected" ? <p>Pickup completed.</p> : null}
          {["matched", "packaging_notified"].includes(donation.status) ? <Link className="primary-button" to={`/donor/donations/${donation.id}#packaging`}>Prepare and schedule pickup</Link> : null}
          <Link className="secondary-button" to={`/donor/donations/${donation.id}`}>View donation</Link>
        </div>
      ))}
    </DonorShell>
  );
}

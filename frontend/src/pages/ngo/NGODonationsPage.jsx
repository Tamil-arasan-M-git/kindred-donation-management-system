import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import StatusBadge from "../../components/common/StatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import NGOShell from "./NGOShell";

export default function NGODonationsPage() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDonations = () => {
    setLoading(true);
    api
      .get("/api/donations")
      .then(setDonations)
      .catch((err) =>
        setError(err.message || "Donation records could not be loaded."),
      )
      .finally(() => setLoading(false));
  };

  useEffect(loadDonations, []);

  return (
    <NGOShell>
      <PageHeader
        eyebrow="Browse donations"
        title="Incoming contributions"
        description="View donations associated with your organization through accepted matches."
      />
      {error ? (
        <ErrorMessage onRetry={loadDonations}>{error}</ErrorMessage>
      ) : null}
      {loading ? <LoadingState message="Loading donation records..." /> : null}
      {!loading && !error && !donations.length ? (
        <EmptyState title="No donations yet">
          Accepted or associated donations will appear here when the backend
          makes them available to your organization.
        </EmptyState>
      ) : null}
      {!loading && !error && donations.length ? (
        <div className="table-list">
          {donations.map((donation) => (
            <div key={donation.id} className="table-row donation-row">
              <span>Donation {donation.id.slice(0, 8)}</span>
              <span>
                {donation.items
                  .map((item) => `${item.class_name} x${item.quantity}`)
                  .join(", ")}
              </span>
              <StatusBadge status={donation.status} />
              <Link to={`/ngo/donations/${donation.id}`} className="secondary-button small-button">View details</Link>
            </div>
          ))}
        </div>
      ) : null}
    </NGOShell>
  );
}

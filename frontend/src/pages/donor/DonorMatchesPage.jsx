import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import StatusBadge from "../../components/common/StatusBadge";
import DonorShell from "./DonorShell";
import PageHeader from "../../components/layout/PageHeader";
import LoadingState from "../../components/common/LoadingState";
import ErrorMessage from "../../components/common/ErrorMessage";

export default function DonorMatchesPage() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .get("/api/donations")
      .then(setDonations)
      .catch((err) => setError(err.message || "Donations could not be loaded."))
      .finally(() => setLoading(false));
  }, []);
  return (
    <DonorShell>
      <PageHeader eyebrow="Matches" title="Recommended NGOs" description="Review backend-ranked matches for your donations." />
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {loading ? <LoadingState message="Loading matches..." /> : null}
      {!loading && !donations.length ? (
        <div className="empty-state">
          No donations are available for matching yet.
        </div>
      ) : null}
      {!loading && donations.length ? (
        <div className="card-grid">
          {donations.map((donation) => (
            <div key={donation.id} className="info-card">
              <h2>{(donation.items || []).map((item) => `${item.class_name} × ${item.quantity}`).join(", ")}</h2>
              <p>Donation #{donation.id.slice(0, 8).toUpperCase()}</p>
              <p>Status: <StatusBadge status={donation.status} /></p>
              {donation.status === "submitted" ? <p className="muted-text">No match generated yet.</p> : null}
              <Link
                to={`/donor/donations/${donation.id}`}
                className="primary-button small-button"
              >
                View matches
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </DonorShell>
  );
}

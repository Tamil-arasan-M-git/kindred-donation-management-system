import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import StatusBadge from "../../components/common/StatusBadge";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import DonationActions from "../../components/donations/DonationActions";
import DonorShell from "./DonorShell";

export default function DonorDonationsPage() {
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
  const formatDate = (value) => (value ? new Date(value).toLocaleString() : "Not scheduled");
  return (
    <DonorShell>
      <PageHeader eyebrow="Donation history" title="My donations" description="Track every donation from submission through delivery." />
      {loading ? <LoadingState message="Loading donations..." /> : null}
      {error ? <ErrorMessage onRetry={() => { setLoading(true); setError(""); api.get("/api/donations").then(setDonations).catch((err) => setError(err.message || "Donations could not be loaded.")).finally(() => setLoading(false)); }}>{error}</ErrorMessage> : null}
      {!loading && !error && !donations.length ? (
        <div className="empty-state">
          No donations yet. Scan items to create your first donation.
        </div>
      ) : null}
      {!loading && !error && donations.length ? (
        <div className="table-list">
          {donations.map((donation) => (
            <div key={donation.id} className="info-card donation-card">
              <div className="section-heading">
                <Link to={`/donor/donations/${donation.id}`}><h2>Donation #{donation.id.slice(0, 8).toUpperCase()}</h2></Link>
                <StatusBadge status={donation.status} />
              </div>
              <p>{(donation.items || []).map((item) => `${item.class_name} × ${item.quantity}`).join(", ") || "Items unavailable"}</p>
              <p className="muted-text">Total quantity: {(donation.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0)}</p>
              {donation.ngo_name || donation.ngo?.name ? <p>NGO: {donation.ngo_name || donation.ngo.name}</p> : null}
              <p className="muted-text">{donation.pickup_scheduled_at ? `Pickup: ${formatDate(donation.pickup_scheduled_at)}` : `Created: ${formatDate(donation.created_at)}`}</p>
              <div className="action-stack"><Link to={`/donor/donations/${donation.id}`} className="primary-button small-button">View details</Link><DonationActions donation={donation} /></div>
            </div>
          ))}
        </div>
      ) : null}
    </DonorShell>
  );
}

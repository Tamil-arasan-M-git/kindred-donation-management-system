import { useEffect, useState } from "react";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import StatusBadge from "../../components/common/StatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import { getStatusLabel } from "../../utils/status";
import AdminShell from "./AdminShell";

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const loadDonations = () => {
    setLoading(true);
    setError("");
    api
      .getDonations()
      .then(setDonations)
      .catch((err) =>
        setError(err.message || "Donation records could not be loaded."),
      )
      .finally(() => setLoading(false));
  };
  useEffect(loadDonations, []);
  const openDetails = async (donation) => {
    setError("");
    try {
      const [detail, history, matches] = await Promise.all([
        api.get(`/api/donations/${donation.id}`),
        api.getStatusHistory(donation.id),
        api.getDonationMatches(donation.id),
      ]);
      setSelectedDonation({
        detail,
        history: history.history || [],
        matches: matches.matches || [],
      });
    } catch (err) {
      setError(err.message || "Donation details could not be loaded.");
    }
  };
  const visibleDonations =
    statusFilter === "all"
      ? donations
      : donations.filter((donation) => donation.status === statusFilter);
  return (
    <AdminShell>
      <PageHeader
        eyebrow="Donations"
        title="Donation management"
        description="Monitor donation status and inspect backend-confirmed history and matches."
      />
      <div className="filter-row">
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter donations by status"
        >
          <option value="all">All statuses</option>
          {[
            "submitted",
            "matched",
            "packaging_notified",
            "pickup_scheduled",
            "collected",
            "delivered",
            "acknowledged",
            "cancelled",
          ].map((status) => (
            <option key={status} value={status}>
              {getStatusLabel(status)}
            </option>
          ))}
        </select>
      </div>
      {error ? <ErrorMessage onRetry={loadDonations}>{error}</ErrorMessage> : null}
      {loading ? <LoadingState message="Loading donation records..." /> : null}
      {!loading && !error && !visibleDonations.length ? (
        <EmptyState title="No donations found">
          Donation records returned by the backend will appear here.
        </EmptyState>
      ) : null}
      {!loading && !error && visibleDonations.length ? (
        <div className="table-list">
          {visibleDonations.map((donation) => (
            <div key={donation.id} className="table-row donation-row">
              <span>Donation #{donation.id.slice(0, 8).toUpperCase()}</span>
              <span>
                {donation.items
                  .map((item) => `${item.class_name} x${item.quantity}`)
                  .join(", ")}
              </span>
              <StatusBadge status={donation.status} />
              <span className="muted-text">{donation.ngo?.name || "No NGO assigned"}</span>
              <span className="muted-text">{donation.created_at ? new Date(donation.created_at).toLocaleDateString() : "—"}</span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => openDetails(donation)}
              >
                Details
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {selectedDonation ? (
        <div className="detail-panel">
          <div className="section-heading">
            <h2>Donation {selectedDonation.detail.id.slice(0, 8)}</h2>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedDonation(null)}
            >
              Close
            </button>
          </div>
          <StatusBadge status={selectedDonation.detail.status} />
          <p>
            {selectedDonation.detail.items
              .map((item) => `${item.class_name} x${item.quantity}`)
              .join(", ")}
          </p>
          <h3>Status history</h3>
          {selectedDonation.history.length ? (
            <ul className="stack-list">
              {selectedDonation.history.map((event, index) => (
                <li key={`${event.changed_at}-${index}`}>
                  {event.new_status}
                  {event.changed_at
                    ? ` · ${new Date(event.changed_at).toLocaleString()}`
                    : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-text">No status history is available.</p>
          )}
          <h3>Matches</h3>
          {selectedDonation.matches.length ? (
            <ul className="stack-list">
              {selectedDonation.matches.map((match) => (
                <li key={match.id}>
                  {match.ngo_name}: {Math.round(match.score * 100)}%,{" "}
                  {getStatusLabel(match.status)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-text">No matches are available.</p>
          )}
        </div>
      ) : null}
    </AdminShell>
  );
}

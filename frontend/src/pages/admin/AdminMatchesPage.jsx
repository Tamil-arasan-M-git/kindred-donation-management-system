import { useEffect, useState } from "react";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import StatusBadge from "../../components/common/StatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import api from "../../api/client";
import { getStatusLabel } from "../../utils/status";
import AdminShell from "./AdminShell";

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMatches = async () => {
      setLoading(true);
      setError("");
      try {
        const ngos = await api.get("/api/ngos");
        const scoped = await Promise.all(
          ngos.map(async (ngo) => {
            const records = await api.get(`/api/ngos/${ngo.id}/matches`);
            return records.map((match) => ({ ...match, ngo_name: ngo.name }));
          }),
        );
        setMatches(scoped.flat());
      } catch (err) {
        setError(err.message || "Match records could not be loaded.");
      } finally {
        setLoading(false);
      }
  };
  useEffect(() => {
    loadMatches();
  }, []);

  const visibleMatches =
    status === "all"
      ? matches
      : matches.filter((match) => match.status === status);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Matches"
        title="Match intelligence"
        description="Inspect backend-created matches and their current state across the NGO network."
      />
      <div className="filter-row">
        <select
          className="filter-select"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter matches by status"
        >
          <option value="all">All statuses</option>
          {["candidate", "recommended", "accepted", "rejected", "expired"].map(
            (item) => (
              <option key={item} value={item}>
                {getStatusLabel(item)}
              </option>
            ),
          )}
        </select>
      </div>
      {error ? <ErrorMessage onRetry={loadMatches}>{error}</ErrorMessage> : null}
      {loading ? <LoadingState message="Loading match records..." /> : null}
      {!loading && !error && !visibleMatches.length ? (
        <EmptyState title="No matches found">
          Matches will appear when compatible donations and active NGO demands
          are processed by the backend.
        </EmptyState>
      ) : null}
      {!loading && !error && visibleMatches.length ? (
        <div className="table-list">
          {visibleMatches.map((match) => (
            <div key={match.id} className="table-row donation-row">
              <span>{match.ngo_name}</span>
              <span>
                Donation {match.donation?.id?.slice(0, 8) || "unavailable"}
              </span>
              <span>
                {match.donation?.items
                  ?.map((item) => `${item.class_name} x${item.quantity}`)
                  .join(", ") || "Items unavailable"}
              </span>
              <span>{Math.round(match.score * 100)}%</span>
              <StatusBadge status={match.status} />
            </div>
          ))}
        </div>
      ) : null}
    </AdminShell>
  );
}

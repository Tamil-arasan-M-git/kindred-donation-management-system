import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import StatusBadge from "../../components/common/StatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import { loadCurrentNgo } from "./ngoUtils";
import NGOShell from "./NGOShell";

const matchStatuses = [
  "all",
  "candidate",
  "recommended",
  "accepted",
  "rejected",
];

export default function NGOMatchesPage() {
  const { user } = useAuth();
  const [ngo, setNgo] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canMutateMatch = (match) => {
    if (!user || user.role !== "ngo") return false;
    return ["candidate", "recommended"].includes(match.status);
  };

  const loadMatches = async () => {
    setLoading(true);
    try {
      const currentNgo = ngo || (await loadCurrentNgo(user.email));
      setNgo(currentNgo);
      const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      setMatches(await api.get(`/api/ngos/${currentNgo.id}/matches${query}`));
    } catch (err) {
      setError(err.message || "Matches could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.email) return;
    loadMatches();
  }, [user?.email, statusFilter]);

  const openMatch = async (match) => {
    setError("");
    try {
      setSelectedMatch(await api.get(`/api/matches/${match.id}`));
    } catch (err) {
      setError(err.message || "Match details could not be loaded.");
    }
  };

  const updateMatch = async (matchId, action) => {
    if (action === "accept" && !window.confirm("Accept this donation? This will associate it with your organization.")) return;
    const rejectionReason = action === "reject"
      ? window.prompt("Reject this donation? Enter an optional reason:", "")
      : "";
    if (action === "reject" && rejectionReason === null) return;
    setActionId(matchId);
    setError("");
    setNotice("");
    try {
      if (action === "accept") await api.acceptMatch(matchId);
      else await api.rejectMatch(matchId, rejectionReason || "NGO declined this recommendation");
      setSelectedMatch(null);
      await loadMatches();
      setNotice(
        action === "accept"
          ? "Match accepted successfully."
          : "Match rejected.",
      );
    } catch (err) {
      setError(err.message || `Match could not be ${action}ed.`);
    } finally {
      setActionId("");
    }
  };

  return (
    <NGOShell>
      <PageHeader
        eyebrow="Incoming matches"
        title="Open opportunities"
        description="Review donation matches created from your active demands."
      />
      {error ? (
        <ErrorMessage onRetry={loadMatches}>{error}</ErrorMessage>
      ) : null}
      {notice ? <div className="success-box">{notice}</div> : null}
      <div className="filter-row" aria-label="Filter matches">
        {matchStatuses.map((status) => (
          <button
            key={status}
            type="button"
            className={`filter-button ${statusFilter === status ? "selected" : ""}`}
            onClick={() => setStatusFilter(status)}
          >
            {status === "all" ? "All" : status}
          </button>
        ))}
      </div>
      {loading ? <LoadingState message="Loading incoming matches..." /> : null}
      {!loading && !matches.length ? (
        <EmptyState title="No matches found">
          Create an active demand to let the system identify suitable incoming
          donations.
        </EmptyState>
      ) : null}
      {!loading && matches.length ? (
        <div className="card-grid">
          {matches.map((match) => (
            <article key={match.id} className="info-card match-card">
              <div className="match-card-top">
                <h2>
                  Donation{" "}
                  {match.donation?.id?.slice(0, 8) || "reference unavailable"}
                </h2>
                <StatusBadge status={match.status} />
              </div>
              <p>
                {match.donation?.items
                  ?.map((item) => `${item.class_name} x${item.quantity}`)
                  .join(", ") || "Donation items unavailable"}
              </p>
              <strong>
                {typeof match.score === "number"
                  ? `${Math.round(match.score * 100)}% match`
                  : "Match available"}
              </strong>
              <p className="muted-text">
                Review the match details before accepting or rejecting this
                opportunity.
              </p>
              <div className="action-stack">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => openMatch(match)}
                >
                  View details
                </button>
                {canMutateMatch(match) ? (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={actionId === match.id}
                      onClick={() => updateMatch(match.id, "accept")}
                    >
                      {actionId === match.id ? "Saving..." : "Accept"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={actionId === match.id}
                      onClick={() => updateMatch(match.id, "reject")}
                    >
                      Reject
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {selectedMatch ? (
        <div className="detail-panel">
          <div className="section-heading">
            <h2>Match details</h2>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedMatch(null)}
            >
              Close
            </button>
          </div>
          <StatusBadge status={selectedMatch.status} />
          <p>Donation: {selectedMatch.donation_id?.slice(0, 8)}</p>
          <p>
            Match score:{" "}
            {typeof selectedMatch.score === "number"
              ? Math.round(selectedMatch.score * 100)
              : 0}
            %
          </p>
          <ul className="stack-list">
            <li>
              Category compatibility:{" "}
              {Math.round(selectedMatch.item_match_score * 100)}%
            </li>
            <li>
              Quantity fit: {Math.round(selectedMatch.quantity_score * 100)}%
            </li>
            <li>
              Geographic proximity:{" "}
              {Math.round(selectedMatch.distance_score * 100)}%
            </li>
            <li>
              Demand priority: {Math.round(selectedMatch.priority_score * 100)}%
            </li>
          </ul>
          {selectedMatch.rejection_reason ? (
            <p>Rejection reason: {selectedMatch.rejection_reason}</p>
          ) : null}
        </div>
      ) : null}
    </NGOShell>
  );
}

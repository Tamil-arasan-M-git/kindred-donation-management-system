import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardSummary } from "../../components/layout/DashboardLayout";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import api from "../../api/client";
import NGOShell from "./NGOShell";

export default function NGODashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getNgoDashboard()
      .then(setSummary)
      .catch((err) =>
        setError(err.message || "NGO dashboard data could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, []);

  const summaryItems = [
    { label: "Active demands", value: summary?.active_demands ?? 0 },
    { label: "Incoming matches", value: summary?.incoming_matches ?? 0 },
    { label: "Accepted matches", value: summary?.accepted_matches ?? 0 },
    { label: "Active donations", value: summary?.active_donations ?? 0 },
  ];

  return (
    <NGOShell>
      <PageHeader
        eyebrow="NGO overview"
        title="Operations dashboard"
        description="Manage your demands and review suitable incoming donations."
        action={
          <Link to="/ngo/demands" className="primary-button">
            Create demand
          </Link>
        }
      />
      {loading ? (
        <LoadingState message="Loading your organization activity..." />
      ) : null}
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {!loading && !error ? <DashboardSummary items={summaryItems} /> : null}
      {!loading && !error ? (
        <section className="card-grid">
          <div className="info-card">
            <h2>Active demands</h2>
            {(summary?.demand_summary || []).length ? (
              <ul className="stack-list">
                {summary.demand_summary.slice(0, 3).map((demand) => (
                  <li key={demand.id}>
                    {demand.class_name}: {demand.quantity_needed} needed
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text">
                Create a demand to let donors help your organization.
              </p>
            )}
          </div>
          <div className="info-card">
            <h2>Quick actions</h2>
            <div className="action-stack">
              <Link to="/ngo/staff" className="secondary-button">Manage staff</Link>
              <Link to="/ngo/operations" className="secondary-button">View operations</Link>
              <Link to="/ngo/donations" className="secondary-button">View donations</Link>
              <Link to="/ngo/matches" className="secondary-button">View matches</Link>
            </div>
          </div>
          <div className="info-card">
            <h2>Incoming matches</h2>
            {(summary?.recent_activity || []).length ? (
              <>
                <ul className="stack-list">
                  {summary.recent_activity.slice(0, 3).map((activity, index) => (
                    <li key={activity.id || index}>
                      {activity.status || activity.title || "Activity"}{activity.description ? ` — ${activity.description}` : ""}
                    </li>
                  ))}
                </ul>
                <Link to="/ngo/matches" className="primary-button small-button">
                  View all matches →
                </Link>
              </>
            ) : (
              <p className="muted-text">No incoming matches found yet.</p>
            )}
          </div>
        </section>
      ) : null}
    </NGOShell>
  );
}

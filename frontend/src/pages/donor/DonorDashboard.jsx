import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardSummary } from "../../components/layout/DashboardLayout";
import api from "../../api/client";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import DonorShell from "./DonorShell";

export default function DonorDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  useEffect(() => {
    api
      .getDonorDashboard()
      .then(setDashboard)
      .catch((err) =>
        setError(err.message || "Dashboard data could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api
      .get("/api/donors/me")
      .then((profile) =>
        setProfileIncomplete(
          !profile.name?.trim() || !profile.phone?.trim() || !profile.city?.trim(),
        ),
      )
      .catch(() => setProfileIncomplete(false));
  }, []);

  const summaryItems = [
    { label: "Total donations", value: dashboard?.total_donations ?? 0 },
    { label: "Active matches", value: dashboard?.active_matches ?? 0 },
    { label: "Pickup due", value: dashboard?.pickup_due ?? 0 },
    { label: "Completed", value: dashboard?.completed_donations ?? 0 },
  ];

  return (
    <DonorShell>
      <PageHeader
        eyebrow="Donor overview"
        title="Good work this week"
        description="Track your donations, matches, and pickup progress."
        action={
          <Link to="/donor/scan" className="primary-button">
            Scan items
          </Link>
        }
      />
      {loading ? (
        <LoadingState message="Loading your donation activity..." />
      ) : null}
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {!loading && !error ? <DashboardSummary items={summaryItems} /> : null}
      {profileIncomplete ? (
        <div className="info-card profile-reminder">
          <h2>Your profile is incomplete.</h2>
          <p>Complete your profile to improve donation matching.</p>
          <Link to="/donor/profile" className="secondary-button">
            Complete Profile
          </Link>
        </div>
      ) : null}
      <section className="card-grid">
        {dashboard?.impact ? <div className="info-card"><h2>Your impact</h2><p>{dashboard.impact.items_donated ?? 0} items donated · {dashboard.impact.completed_donations ?? 0} completed donations · {dashboard.impact.ngos_supported ?? 0} NGOs supported</p></div> : null}
        <div className="info-card">
          <h2>Recent activity</h2>
          {!loading && !(dashboard?.recent_activity || []).length ? (
            <p className="muted-text">
              Your donation activity will appear here after your first
              submission.
            </p>
          ) : null}
          {(dashboard?.recent_activity || []).length ? (
            <ul className="stack-list">
              {dashboard.recent_activity.slice(0, 5).map((activity, index) => (
                <li key={activity.id || `${activity.timestamp}-${index}`}>
                  <strong>{activity.status || activity.title || "Activity"}</strong>{activity.description || activity.notes ? ` — ${activity.description || activity.notes}` : ""}
                  {activity.timestamp || activity.created_at ? <small className="activity-time">{new Date(activity.timestamp || activity.created_at).toLocaleString()}</small> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="info-card">
          <h2>Quick actions</h2>
          <div className="action-stack">
            <Link to="/donor/scan" className="secondary-button">
              Scan new items
            </Link>
            <Link to="/donor/donations" className="secondary-button">
              View donations
            </Link>
          </div>
        </div>
      </section>
    </DonorShell>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardSummary } from "../../components/layout/DashboardLayout";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import api from "../../api/client";
import AdminShell from "./AdminShell";

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = async () => {
      setLoading(true);
      setError("");
      try {
        const [ngos, donations, donors] = await Promise.all([
          api.get("/api/ngos"),
          api.getDonations(),
          api.getAdminDonors(),
        ]);
        const scopedData = await Promise.all(
          ngos.map(async (ngo) => {
            const [demands, matches] = await Promise.all([
              api.get(`/api/ngos/${ngo.id}/demands`),
              api.get(`/api/ngos/${ngo.id}/matches`),
            ]);
            return { demands, matches };
          }),
        );
        setSummary({
          ngos,
          donations,
          donors,
          demands: scopedData.flatMap((item) => item.demands),
          matches: scopedData.flatMap((item) => item.matches),
        });
      } catch (err) {
        setError(err.message || "Admin summary could not be loaded.");
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const summaryItems = summary
    ? [
        { label: "Registered donors", value: summary.donors.length },
        { label: "Registered NGOs", value: summary.ngos.length },
        { label: "Donations", value: summary.donations.length },
        {
          label: "Active demands",
          value: summary.demands.filter((demand) => demand.quantity_needed > 0)
            .length,
        },
        { label: "Matches", value: summary.matches.length },
      ]
    : [];

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin overview"
        title="Platform health"
        description="Monitor the donation network using data currently available from the backend."
      />
      {loading ? <LoadingState message="Loading platform summary..." /> : null}
      {error ? <ErrorMessage onRetry={loadSummary}>{error}</ErrorMessage> : null}
      {summary ? (
        <>
          <DashboardSummary items={summaryItems} />
          <div className="card-grid">
            <div className="info-card">
              <h2>Network snapshot</h2>
              <ul className="stack-list">
                <li>
                  {summary.ngos.filter((ngo) => ngo.verified).length} verified
                  NGOs
                </li>
                <li>{summary.donations.filter((donation) => donation.status === "acknowledged").length} acknowledged donations</li>
                <li>{summary.donations.filter((donation) => !["acknowledged", "cancelled"].includes(donation.status)).length} active donations</li>
                <li>
                  {summary.ngos.filter((ngo) => !ngo.verified).length}{" "}
                  unverified NGOs
                </li>
                <li>
                  {
                    summary.matches.filter((match) =>
                      ["candidate", "recommended"].includes(match.status),
                    ).length
                  }{" "}
                  open matches
                </li>
              </ul>
            </div>
            <div className="info-card">
              <h2>Admin actions</h2>
              <div className="action-stack">
                <Link to="/admin/ngos" className="secondary-button">
                  Review NGOs
                </Link>
                <Link to="/admin/donations" className="secondary-button">
                  Monitor donations
                </Link>
                <Link to="/admin/demands" className="secondary-button">
                  View demands
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}

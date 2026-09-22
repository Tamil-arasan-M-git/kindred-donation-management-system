import { useEffect, useState } from "react";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import PageHeader from "../../components/layout/PageHeader";
import AdminShell from "./AdminShell";

const PAGE_SIZE = 50;

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

export default function AdminDonorsPage() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);

  const loadDonors = async (nextOffset = offset) => {
    setLoading(true);
    setError("");

    try {
      const data = await api.getAdminDonors(PAGE_SIZE, nextOffset);
      setDonors(Array.isArray(data) ? data : []);
      setOffset(nextOffset);
    } catch (err) {
      setError(
        err?.status === 403
          ? "You are not authorized to view the donor directory."
          : "Unable to load donor records. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDonors(0);
  }, []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Donors"
        title="Donor directory"
        description="View registered donors."
      />

      {loading ? (
        <EmptyState title="Loading donors">Loading donor records...</EmptyState>
      ) : null}

      {!loading && error ? (
        <EmptyState
          title="Unable to load donors"
          action={
            <button
              type="button"
              className="secondary-button"
              onClick={() => loadDonors(offset)}
            >
              Retry
            </button>
          }
        >
          {error}
        </EmptyState>
      ) : null}

      {!loading && !error && donors.length === 0 ? (
        <EmptyState title="No donors found">
          There are currently no donor records.
        </EmptyState>
      ) : null}

      {!loading && !error && donors.length > 0 ? (
        <>
          <div className="donor-table-wrap">
            <table className="donor-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">City</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {donors.map((donor) => (
                  <tr key={donor.id}>
                    <td>{donor.name || "—"}</td>
                    <td>{donor.email || "—"}</td>
                    <td>{donor.phone || "—"}</td>
                    <td>{donor.city || "—"}</td>
                    <td>{formatDate(donor.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="donor-pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={offset === 0 || loading}
              onClick={() => loadDonors(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={donors.length < PAGE_SIZE || loading}
              onClick={() => loadDonors(offset + PAGE_SIZE)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}

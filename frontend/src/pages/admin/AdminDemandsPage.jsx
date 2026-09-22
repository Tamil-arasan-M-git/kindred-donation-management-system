import { useEffect, useState } from "react";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import api from "../../api/client";
import AdminShell from "./AdminShell";

export default function AdminDemandsPage() {
  const [demands, setDemands] = useState([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDemands = async () => {
      try {
        const ngos = await api.get("/api/ngos");
        const scoped = await Promise.all(
          ngos.map(async (ngo) => {
            const records = await api.get(`/api/ngos/${ngo.id}/demands`);
            return records.map((demand) => ({ ...demand, ngo_name: ngo.name }));
          }),
        );
        setDemands(scoped.flat());
      } catch (err) {
        setError(err.message || "Demand records could not be loaded.");
      } finally {
        setLoading(false);
      }
    };
    loadDemands();
  }, []);

  const visibleDemands =
    category === "all"
      ? demands
      : demands.filter((demand) => demand.class_name === category);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Demands"
        title="NGO demand pipelines"
        description="Review demand records collected through supported NGO-scoped endpoints."
      />
      <div className="filter-row">
        <select
          className="filter-select"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter demands by category"
        >
          <option value="all">All categories</option>
          {[
            "clothing",
            "food",
            "books",
            "electronics",
            "furniture",
            "utensils",
          ].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {loading ? <LoadingState message="Loading demand records..." /> : null}
      {!loading && !error && !visibleDemands.length ? (
        <EmptyState title="No demands found">
          Demand records will appear here when NGOs create active or historical
          demands.
        </EmptyState>
      ) : null}
      {!loading && !error && visibleDemands.length ? (
        <div className="table-list">
          {visibleDemands.map((demand) => (
            <div key={demand.id} className="table-row donation-row">
              <span>{demand.ngo_name}</span>
              <span>
                {demand.class_name} · {demand.quantity_needed} needed
              </span>
              <span>Priority {demand.priority}</span>
              <span>{demand.expiry_date || "No expiry"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </AdminShell>
  );
}

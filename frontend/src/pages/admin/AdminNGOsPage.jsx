import { useEffect, useState } from "react";
import api from "../../api/client";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import AdminShell from "./AdminShell";

export default function AdminNGOsPage() {
  const [ngos, setNgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedNgo, setSelectedNgo] = useState(null);
  const loadNgos = () => {
    setLoading(true);
    api
      .get("/api/ngos")
      .then(setNgos)
      .catch((err) => setError(err.message || "NGOs could not be loaded."))
      .finally(() => setLoading(false));
  };
  useEffect(loadNgos, []);
  const updateVerification = async (ngo) => {
    if (!window.confirm(`${ngo.verified ? "Unverify" : "Verify"} ${ngo.name}?`)) return;
    setUpdatingId(ngo.id);
    setError("");
    setNotice("");
    try {
      const updatedNgo = await api.patch(`/api/ngos/${ngo.id}/verification`, {
        verified: !ngo.verified,
      });
      setNgos((current) =>
        current.map((item) => (item.id === ngo.id ? updatedNgo : item)),
      );
      setNotice(
        `${updatedNgo.name} is now ${updatedNgo.verified ? "verified" : "unverified"}.`,
      );
    } catch (err) {
      setError(err.message || "Verification could not be updated.");
    } finally {
      setUpdatingId("");
    }
  };
  const openDetails = async (ngo) => {
    setError("");
    try {
      const [profile, demands] = await Promise.all([
        api.get(`/api/ngos/${ngo.id}`),
        api.get(`/api/ngos/${ngo.id}/demands`),
      ]);
      setSelectedNgo({ profile, demands });
    } catch (err) {
      setError(err.message || "NGO details could not be loaded.");
    }
  };
  const visibleNgos = ngos.filter((ngo) =>
    `${ngo.name} ${ngo.city || ""} ${ngo.contact_email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <AdminShell>
      <PageHeader
        eyebrow="NGOs"
        title="Organization management"
        description="Review NGO profiles and manage backend verification state."
      />
      <div className="filter-row">
        <input
          className="search-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search organizations"
          aria-label="Search organizations"
        />
      </div>
      {error ? <ErrorMessage onRetry={loadNgos}>{error}</ErrorMessage> : null}
      {notice ? <div className="success-box">{notice}</div> : null}
      {loading ? <LoadingState message="Loading NGO records..." /> : null}
      {!loading && !visibleNgos.length ? (
        <div className="empty-state">No NGOs have been registered yet.</div>
      ) : null}
      {!loading && visibleNgos.length ? (
        <div className="table-list">
          {visibleNgos.map((ngo) => (
            <div key={ngo.id} className="table-row donation-row">
              <span>{ngo.name}</span>
              <span>{ngo.city || "Location not provided"}</span>
              <span
                className={`status-pill ${ngo.verified ? "status-matched" : "status-submitted"}`}
              >
                {ngo.verified ? "Verified" : "Unverified"}
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => updateVerification(ngo)}
                disabled={updatingId === ngo.id}
              >
                {updatingId === ngo.id
                  ? "Saving..."
                  : ngo.verified
                    ? "Unverify"
                    : "Verify"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => openDetails(ngo)}
              >
                Details
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {selectedNgo ? (
        <div className="detail-panel">
          <div className="section-heading">
            <h2>{selectedNgo.profile.name}</h2>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedNgo(null)}
            >
              Close
            </button>
          </div>
          <p>{selectedNgo.profile.city || "Location not provided"}</p>
          <p>{selectedNgo.profile.contact_email}</p>
          <p>{selectedNgo.profile.contact_phone || "Phone not provided"}</p>
          <p>
            Verification:{" "}
            {selectedNgo.profile.verified ? "Verified" : "Unverified"}
          </p>
          <h3>Demands</h3>
          {selectedNgo.demands.length ? (
            <ul className="stack-list">
              {selectedNgo.demands.map((demand) => (
                <li key={demand.id}>
                  {demand.class_name}: {demand.quantity_needed} needed, priority{" "}
                  {demand.priority}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-text">No demands are currently recorded.</p>
          )}
        </div>
      ) : null}
    </AdminShell>
  );
}

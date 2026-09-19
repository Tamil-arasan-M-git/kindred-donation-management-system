import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/client";
import StatusBadge from "../../components/common/StatusBadge";
import DonorShell from "./DonorShell";
import DonationStatusTimeline from "../../components/donations/DonationStatusTimeline";
import DonationActions from "../../components/donations/DonationActions";
import PackagingChecklist from "../../components/donations/PackagingChecklist";
import PickupScheduler from "../../components/donations/PickupScheduler";

export default function DonorDonationDetailPage() {
  const { id } = useParams();
  const [donation, setDonation] = useState(null);
  const [history, setHistory] = useState([]);
  const [matches, setMatches] = useState([]);
  const [isGeneratingMatches, setIsGeneratingMatches] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [packagingReady, setPackagingReady] = useState(false);
  const handlePackagingReady = useCallback(
    (ready) => setPackagingReady(ready),
    [],
  );

  const loadDonation = useCallback(async () => {
    const [loadedDonation, loadedHistory, loadedMatches] = await Promise.all([
      api.get(`/api/donations/${id}`),
      api.getStatusHistory(id),
      api.getDonationMatches(id),
    ]);
    setDonation(loadedDonation);
    setHistory(loadedHistory.history || []);
    setMatches(loadedMatches.matches || []);
  }, [id]);

  useEffect(() => {
    loadDonation()
      .catch((err) =>
        setError(err.message || "Donation details could not be loaded."),
      );
  }, [loadDonation]);

  const generateMatches = async () => {
    if (isGeneratingMatches) return;

    setIsGeneratingMatches(true);
    setError("");
    setNotice("Finding suitable NGOs...");

    try {
      const response = await api.generateMatches(id);
      const nextMatches = response.matches || [];
      setMatches(nextMatches);
      setNotice(
        nextMatches.length
          ? `Matches found: ${nextMatches.length}`
          : "No suitable NGO matches were found yet.",
      );
    } catch (err) {
      setError(err.message || "Matches could not be generated.");
    } finally {
      setIsGeneratingMatches(false);
    }
  };

  const cancelDonation = async () => {
    if (!window.confirm("Cancel this donation? This action cannot be undone."))
      return;
    setCancelling(true);
    setError("");
    setNotice("");
    try {
      const cancelledDonation = await api.cancelDonation(id);
      setDonation(cancelledDonation);
      await loadDonation();
      setNotice("Your donation was cancelled.");
    } catch (err) {
      setError(err.message || "The donation could not be cancelled.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <DonorShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Donation detail</p>
          <h1>Donation journey</h1>
        </div>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      {notice ? <div className="success-box">{notice}</div> : null}
      {!donation && !error ? (
        <div className="empty-state">Loading donation details...</div>
      ) : null}
      {donation ? (
        <>
          <div className="info-card wide-card">
            <StatusBadge status={donation.status} />
            <p>
              {donation.items
                .map((item) => `${item.class_name} x${item.quantity}`)
                .join(", ")}
            </p>
            <DonationActions donation={donation} />
            {[
              "submitted",
              "matched",
              "packaging_notified",
              "pickup_scheduled",
            ].includes(donation.status) ? (
              <button
                type="button"
                className="secondary-button"
                onClick={cancelDonation}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : "Cancel donation"}
              </button>
            ) : null}
          </div>
          <div className="info-card wide-card timeline-card">
            <h2>Status</h2>
            <DonationStatusTimeline status={donation.status} history={history} />
          </div>
          { ["matched", "packaging_notified"].includes(donation.status) ? (
            <div className="info-card wide-card" id="packaging">
              <h2>Prepare your donation</h2>
              <PackagingChecklist
                donation={donation}
                onReady={handlePackagingReady}
              />
              {donation.status === "packaging_notified" && packagingReady ? (
                <div id="pickup" className="inline-section">
                  <h3>Schedule pickup</h3>
                  <PickupScheduler
                    donation={donation}
                    onScheduled={async () => {
                      await loadDonation();
                      setNotice("Pickup scheduled successfully.");
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="info-card wide-card">
            <div className="section-heading">
              <h2>NGO matches</h2>
              <button
                type="button"
                className="primary-button small-button"
                onClick={generateMatches}
                disabled={isGeneratingMatches}
              >
                {isGeneratingMatches ? "Finding Matches..." : "Find matches"}
              </button>
            </div>
            {!matches.length ? (
              <p className="muted-text">
                No matches are available yet. Find matches to ask the backend
                for ranked recommendations.
              </p>
            ) : null}
            {matches.map((match) => (
              <div key={match.id} className="match-row">
                <div>
                  <strong>{match.ngo_name || match.ngo?.name || "NGO"}</strong>
                  <p>
                    {typeof match.score === "number"
                      ? `${Math.round(match.score * 100)}% match`
                      : "Recommendation available"}
                    {match.explanation?.[0]
                      ? ` · ${match.explanation[0]}`
                      : " · Rule-based compatibility"}
                  </p>
                </div>
                <div className="action-stack inline-actions">
                  <StatusBadge status={match.status || "candidate"} />
                </div>
              </div>
            ))}
          </div>
          <div className="info-card wide-card timeline-card">
            <h2>Status history</h2>
            {history.length ? (
              history.map((event, index) => (
                <div
                  key={`${event.changed_at}-${index}`}
                  className="timeline-item"
                >
                  <StatusBadge status={event.new_status} />
                  <span>
                    {event.changed_at
                      ? new Date(event.changed_at).toLocaleString()
                      : ""}
                  </span>
                  {event.notes ? <p>{event.notes}</p> : null}
                </div>
              ))
            ) : (
              <p className="muted-text">No status history is available.</p>
            )}
          </div>
        </>
      ) : null}
    </DonorShell>
  );
}

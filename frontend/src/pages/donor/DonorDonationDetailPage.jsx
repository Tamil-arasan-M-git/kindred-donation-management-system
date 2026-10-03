import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import StatusBadge from "../../components/common/StatusBadge";
import DonorShell from "./DonorShell";
import DonationStatusTimeline from "../../components/donations/DonationStatusTimeline";
import DonationActions from "../../components/donations/DonationActions";
import PackagingChecklist from "../../components/donations/PackagingChecklist";
import PickupScheduler from "../../components/donations/PickupScheduler";
import { formatDonationItem } from "./donorUtils";
import DonorPageHeaderArtwork from "./DonorPageHeaderArtwork";
import "./DonorDonationDetailPage.css";

export default function DonorDonationDetailPage() {
  const { t, i18n } = useTranslation();
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
    loadDonation().catch(() => setError(t("donor.journey.loadError")));
  }, [loadDonation]);

  const generateMatches = async () => {
    if (isGeneratingMatches) return;

    setIsGeneratingMatches(true);
    setError("");
    setNotice(t("donor.journey.findingSuitableNgos"));

    try {
      const response = await api.generateMatches(id);
      const nextMatches = response.matches || [];
      setMatches(nextMatches);
      setNotice(
        nextMatches.length
          ? t("donor.journey.matchesFound", { count: nextMatches.length })
          : t("donor.journey.noSuitableMatches"),
      );
    } catch {
      setError(t("donor.journey.matchesError"));
    } finally {
      setIsGeneratingMatches(false);
    }
  };

  const cancelDonation = async () => {
    if (!window.confirm(t("donor.journey.cancelConfirm"))) return;
    setCancelling(true);
    setError("");
    setNotice("");
    try {
      const cancelledDonation = await api.cancelDonation(id);
      setDonation(cancelledDonation);
      await loadDonation();
      setNotice(t("donor.journey.cancelledSuccess"));
    } catch {
      setError(t("donor.journey.cancelError"));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <DonorShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">{t("donor.journey.eyebrow")}</p>
          <h1>{t("donor.journey.title")}</h1>
        </div>
        <DonorPageHeaderArtwork />
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      {notice ? <div className="success-box">{notice}</div> : null}
      {!donation && !error ? (
        <div className="empty-state">{t("donor.journey.loading")}</div>
      ) : null}
      {donation ? (
        <div className="donor-journey-layout">
          <div className="donor-journey-main">
            <div className="info-card wide-card">
              <StatusBadge status={donation.status} />
              {(donation.items || []).map((item, index) => (
                <p key={`${item.class_name}-${index}`}>
                  {formatDonationItem(item, t)}
                  {item.confidence == null
                    ? ` | ${t("donor.journey.confidenceUnavailable")}`
                    : ` | ${t("donor.journey.aiConfidence", { value: Math.round(item.confidence * 100) })}`}
                  {item.was_edited_by_donor
                    ? ` | ${t("donor.review.reviewedByDonor")}`
                    : ""}
                </p>
              ))}
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
                  {cancelling
                    ? t("donor.journey.cancelling")
                    : t("donor.journey.cancelDonation")}
                </button>
              ) : null}
            </div>
            <div className="info-card wide-card timeline-card">
              <h2>{t("donor.journey.status")}</h2>
              <DonationStatusTimeline
                status={donation.status}
                history={history}
              />
            </div>
            {["matched", "packaging_notified"].includes(donation.status) ? (
              <div className="info-card wide-card" id="packaging">
                <h2>{t("donor.journey.prepareDonation")}</h2>
                <PackagingChecklist
                  donation={donation}
                  onReady={handlePackagingReady}
                />
                {donation.status === "packaging_notified" && packagingReady ? (
                  <div id="pickup" className="inline-section">
                    <h3>{t("donor.journey.schedulePickup")}</h3>
                    <PickupScheduler
                      donation={donation}
                      onScheduled={async () => {
                        await loadDonation();
                        setNotice(t("donor.journey.pickupSuccess"));
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="info-card wide-card">
              <div className="section-heading">
                <h2>{t("donor.journey.ngoMatches")}</h2>
                <button
                  type="button"
                  className="primary-button small-button"
                  onClick={generateMatches}
                  disabled={isGeneratingMatches}
                >
                  {isGeneratingMatches
                    ? t("donor.journey.findingMatches")
                    : t("donor.journey.findMatches")}
                </button>
              </div>
              {!matches.length ? (
                <p className="muted-text">{t("donor.journey.noMatchesHint")}</p>
              ) : null}
              {matches.map((match) => (
                <div key={match.id} className="match-row">
                  <div>
                    <strong>
                      {match.ngo_name ||
                        match.ngo?.name ||
                        t("donor.journey.ngoFallback")}
                    </strong>
                    {(
                      match.requirements ||
                      (match.required_category
                        ? [
                            {
                              category: match.required_category,
                              subcategory: match.required_subcategory,
                              quantity_needed: match.required_quantity,
                            },
                          ]
                        : [])
                    ).map((demand, index) => (
                      <p key={`${demand.category}-${index}`}>
                        {t("donor.journey.required")}:{" "}
                        {t(
                          `categories.${String(demand.category || "").toLowerCase()}`,
                          { defaultValue: demand.category },
                        )}
                        {demand.subcategory
                          ? ` / ${t(`categories.${String(demand.subcategory).toLowerCase()}`, { defaultValue: demand.subcategory })}`
                          : ` / ${t("donor.journey.anySubcategory")}`}{" "}
                        | {t("donor.journey.quantity")}:{" "}
                        {demand.quantity_needed}
                      </p>
                    ))}
                    <p>
                      {typeof match.score === "number"
                        ? t("donor.journey.matchPercent", {
                            value: Math.round(match.score * 100),
                          })
                        : t("donor.journey.recommendationAvailable")}
                      {` | ${t("donor.journey.ruleCompatibility")}`}
                    </p>
                  </div>
                  <div className="action-stack inline-actions">
                    <StatusBadge status={match.status || "candidate"} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <aside className="donor-journey-history info-card timeline-card">
            <h2>{t("donor.journey.statusHistory")}</h2>
            {history.length ? (
              history.map((event, index) => (
                <div
                  key={`${event.changed_at}-${index}`}
                  className="timeline-item"
                >
                  <StatusBadge status={event.new_status} />
                  <span>
                    {event.changed_at
                      ? new Date(event.changed_at).toLocaleString(
                          i18n.resolvedLanguage,
                        )
                      : ""}
                  </span>
                  {event.notes ? <p>{event.notes}</p> : null}
                </div>
              ))
            ) : (
              <p className="muted-text">{t("donor.journey.noStatusHistory")}</p>
            )}
          </aside>
        </div>
      ) : null}
    </DonorShell>
  );
}

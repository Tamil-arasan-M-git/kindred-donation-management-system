import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import StatusBadge from "../../components/common/StatusBadge";
import DonorShell from "./DonorShell";
import PageHeader from "../../components/layout/PageHeader";
import LoadingState from "../../components/common/LoadingState";
import ErrorMessage from "../../components/common/ErrorMessage";
import { formatDonationItem } from "./donorUtils";
import DonorPageHeaderArtwork from "./DonorPageHeaderArtwork";
import MatchDetailsModal from "../../components/matches/MatchDetailsModal";
import "./DonorMatchesPage.css";

const getMatchIcon = (items = []) => {
  const category = String(
    items[0]?.category || items[0]?.class_name || "",
  ).toLowerCase();
  if (category.includes("electronic") || category.includes("phone"))
    return "mobile-button";
  if (category.includes("book")) return "book-open-cover";
  if (category.includes("cloth") || category.includes("wear")) return "shirt";
  if (category.includes("furniture")) return "couch";
  if (category.includes("food") || category.includes("utensil"))
    return "utensils";
  if (category.includes("toy")) return "gamepad";
  return "box-open";
};

export default function DonorMatchesPage() {
  const { t } = useTranslation();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [matchError, setMatchError] = useState("");

  useEffect(() => {
    api
      .get("/api/donations")
      .then(setDonations)
      .catch(() => setError(t("errors.generic")))
      .finally(() => setLoading(false));
  }, [t]);

  const openMatchDetails = async (match) => {
    setSelectedMatch(match);
    setLoadingMatch(true);
    setMatchError("");
    try {
      setSelectedMatch(await api.getMatch(match.id));
    } catch (err) {
      setMatchError(t("errors.generic"));
    } finally {
      setLoadingMatch(false);
    }
  };

  return (
    <DonorShell>
      <PageHeader
        eyebrow={t("navigation.matches")}
        title={t("donor.matches.title")}
        description={t("donor.matches.description")}
        action={<DonorPageHeaderArtwork />}
        actionClassName="donor-page-header-artwork-action"
      />
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {loading ? <LoadingState message={t("common.loading")} /> : null}
      {!loading && !donations.length ? (
        <div className="empty-state">
          {t("donor.matches.empty")} {t("donor.matches.emptyDesc")}
        </div>
      ) : null}
      {!loading && donations.length ? (
        <div className="donor-matches-grid">
          {donations.map((donation) => (
            <article key={donation.id} className="donor-match-card">
              <div className="donor-match-top">
                <div className="donor-match-art" aria-hidden="true">
                  <i className={`fi fi-rr-${getMatchIcon(donation.items)}`} />
                </div>
                <h2>
                  {(donation.items || [])
                    .map((item) => formatDonationItem(item, t))
                    .join(", ") || t("donor.matches.donationItems")}
                </h2>
              </div>
              <p className="donor-match-id">
                {t("donor.donations.donationId", {
                  id: String(donation.id).slice(0, 8).toUpperCase(),
                })}
              </p>
              <div className="donor-match-status">
                <span>{t("donor.matches.statusLabel")}:</span>
                <StatusBadge status={donation.status} />
              </div>
              {donation.matches?.length ? (
                <div className="donor-match-candidates">
                  <strong>{t("donor.matches.ngoMatches")}</strong>
                  {donation.matches.map((match) => (
                    <div className="donor-match-candidate" key={match.id}>
                      <span>
                        {match.ngo_name || t("donor.journey.ngoFallback")} ·{" "}
                        {t("donor.journey.matchPercent", {
                          value: Math.round((Number(match.score) || 0) * 100),
                        })}{" "}
                        ·{" "}
                        {t(`status.${match.status}`, {
                          defaultValue: match.status,
                        })}
                      </span>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => openMatchDetails(match)}
                      >
                        {t("donor.matches.viewDetails")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-text">{t("donor.matches.noNgoMatch")}</p>
              )}
              <Link
                to={`/donor/donations/${donation.id}`}
                className="donor-match-details"
              >
                <span>{t("donor.matches.viewDetails")}</span>
                <i className="fi fi-rr-arrow-right" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      ) : null}
      <MatchDetailsModal
        match={selectedMatch}
        loading={loadingMatch}
        error={matchError}
        onClose={() => setSelectedMatch(null)}
      />
    </DonorShell>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import StatusBadge from "../../components/common/StatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import { loadCurrentNgo } from "./ngoUtils";
import NGOShell from "./NGOShell";
import MatchDetailsModal from "../../components/matches/MatchDetailsModal";
import "./NGOMatchesPage.css";

const getMatchIcon = (item) => {
  const category = String(
    item?.category || item?.class_name || "",
  ).toLowerCase();
  if (category.includes("electronic") || category.includes("phone"))
    return "mobile-button";
  if (category.includes("book")) return "book-open-cover";
  if (category.includes("cloth") || category.includes("wear")) return "shirt";
  if (category.includes("furniture")) return "couch";
  if (category.includes("food") || category.includes("utensil"))
    return "utensils";
  return "box-open";
};

export default function NGOMatchesPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [ngo, setNgo] = useState(null);
  const [matches, setMatches] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const categoryLabel = (value) =>
    t(`categories.${String(value || "").toLowerCase()}`, {
      defaultValue: value || t("ngo.matches.notSpecified"),
    });

  const loadMatches = async () => {
    setLoading(true);
    try {
      const currentNgo = ngo || (await loadCurrentNgo(user.email));
      setNgo(currentNgo);
      const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      setMatches(await api.get(`/api/ngos/${currentNgo.id}/matches${query}`));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.email) return;
    loadMatches();
  }, [user?.email, statusFilter]);

  const handleAction = async (matchId, action) => {
    try {
      await api.post(`/api/matches/${matchId}/${action}`);
      await loadMatches();
    } catch (err) {
      setError(t("errors.generic"));
    }
  };

  return (
    <NGOShell>
      <PageHeader
        eyebrow={t("navigation.matches")}
        title={t("ngo.matches.title")}
        description={t("ngo.matches.description")}
      />
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {loading ? <LoadingState message={t("common.loading")} /> : null}
      {!loading && !matches.length ? (
        <EmptyState title={t("ngo.matches.empty")} />
      ) : null}
      {!loading && matches.length ? (
        <div className="ngo-match-grid">
          {matches.map((match) => (
            <article key={match.id} className="ngo-match-card">
              <div className="ngo-match-card__header">
                <div className="ngo-match-card__art" aria-hidden="true">
                  <i
                    className={`fi fi-rr-${getMatchIcon(match.donation?.items?.[0])}`}
                  />
                </div>
                <div className="ngo-match-card__identity">
                  <p className="ngo-match-card__eyebrow">
                    {t("ngo.matches.donationMatch")}
                  </p>
                  <h2>#{match.id.slice(0, 8).toUpperCase()}</h2>
                </div>
                <StatusBadge status={match.status} />
              </div>
              <p className="ngo-match-card__donation-id">
                {t("ngo.matches.donationId", {
                  id: String(match.donation?.id || match.donation_id || "")
                    .slice(0, 8)
                    .toUpperCase(),
                })}
              </p>
              <div className="ngo-match-card__score">
                <span>{t("ngo.matches.matchStrength")}</span>
                <strong>
                  {typeof match.score === "number"
                    ? `${Math.round(match.score * 100)}%`
                    : "—"}
                </strong>
              </div>
              <div
                className="ngo-match-card__score-track"
                role="progressbar"
                aria-label={t("ngo.matches.matchStrength")}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round((Number(match.score) || 0) * 100)}
              >
                <span
                  style={{
                    width: `${Math.max(0, Math.min(100, (Number(match.score) || 0) * 100))}%`,
                  }}
                />
              </div>
              <div className="ngo-match-card__details">
                <section>
                  <h3>{t("ngo.matches.donationItems")}</h3>
                  {(match.donation?.items || []).length ? (
                    match.donation.items.map((item, index) => (
                      <p key={`${item.class_name}-${index}`}>
                        {categoryLabel(item.category || item.class_name)}
                        {item.subcategory
                          ? ` / ${categoryLabel(item.subcategory)}`
                          : ` / ${t("ngo.matches.notSpecified")}`}
                        <span>
                          {t("ngo.matches.quantity")}: {item.quantity}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p>{t("ngo.matches.itemsUnavailable")}</p>
                  )}
                </section>
                <section>
                  <h3>{t("ngo.matches.yourDemand")}</h3>
                  {(match.requirements || []).map((demand, index) => (
                    <p key={`${demand.category}-${index}`}>
                      {categoryLabel(demand.category)}
                      {demand.subcategory
                        ? ` / ${categoryLabel(demand.subcategory)}`
                        : ` / ${t("ngo.matches.anySubcategory")}`}
                      <span>
                        {t("ngo.matches.needs")}: {demand.quantity_needed}
                      </span>
                    </p>
                  ))}
                </section>
              </div>
              <div className="ngo-match-card__actions">
                <button
                  type="button"
                  className="ngo-match-card__details-button"
                  onClick={() => setSelectedMatch(match)}
                >
                  {t("ngo.matches.viewDetails")}
                </button>
                <div className="button-group">
                  {["candidate", "recommended"].includes(match.status) && (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => handleAction(match.id, "accept")}
                      >
                        {t("common.confirm")}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleAction(match.id, "reject")}
                      >
                        {t("common.cancel")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <MatchDetailsModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />
    </NGOShell>
  );
}

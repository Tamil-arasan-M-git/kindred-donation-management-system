import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import StatusBadge from "../../components/common/StatusBadge";
import MatchDetailsModal from "../../components/matches/MatchDetailsModal";
import DonorPageHeaderArtwork from "../donor/DonorPageHeaderArtwork";
import AdminShell from "./AdminShell";
import "../ngo/NGOMatchesPage.css";
import "./AdminMatchesPage.css";

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

export default function AdminMatchesPage() {
  const { t } = useTranslation();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [matchError, setMatchError] = useState("");

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ngos = await api.get("/api/ngos");
      const lists = await Promise.all(
        ngos.map(async (ngo) =>
          (await api.get(`/api/ngos/${ngo.id}/matches`)).map((match) => ({
            ...match,
            ngo_name: ngo.name,
          })),
        ),
      );
      setMatches(lists.flat());
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const openMatchDetails = async (match) => {
    setSelectedMatch(match);
    setLoadingMatch(true);
    setMatchError("");
    try {
      setSelectedMatch({
        ...(await api.getMatch(match.id)),
        ngo_name: match.ngo_name,
      });
    } catch {
      setMatchError(t("errors.generic"));
    } finally {
      setLoadingMatch(false);
    }
  };

  return (
    <AdminShell>
      <PageHeader
        eyebrow={t("navigation.matches")}
        title={t("admin.matches.title")}
        description={t("admin.matches.description", {
          defaultValue: "Review matched donations across organizations.",
        })}
        action={<DonorPageHeaderArtwork />}
        actionClassName="donor-page-header-artwork-action"
      />
      {error ? (
        <ErrorMessage onRetry={loadMatches}>{error}</ErrorMessage>
      ) : null}
      {loading ? <LoadingState message={t("common.loading")} /> : null}
      {!loading && !error && !matches.length ? (
        <EmptyState title={t("admin.matches.empty")} />
      ) : null}
      {!loading && !error && matches.length ? (
        <div className="ngo-match-grid admin-match-grid">
          {matches.map((match) => {
            const donationId = match.donation?.id || match.donation_id;
            const score = Math.round((Number(match.score) || 0) * 100);
            const items = match.donation?.items || [];
            return (
              <article
                key={match.id}
                className="ngo-match-card admin-match-card"
              >
                <div className="ngo-match-card__header">
                  <div className="ngo-match-card__art" aria-hidden="true">
                    <i className={`fi fi-rr-${getMatchIcon(items)}`} />
                  </div>
                  <div className="ngo-match-card__identity">
                    <p className="ngo-match-card__eyebrow">
                      {t("admin.matches.matchRecord", {
                        defaultValue: "Donation match",
                      })}
                    </p>
                    <h2>#{String(match.id).slice(0, 8).toUpperCase()}</h2>
                  </div>
                  <StatusBadge status={match.status} />
                </div>

                <p className="admin-match-card__ngo">
                  <i className="fi fi-rr-building" aria-hidden="true" />
                  <span>
                    {match.ngo_name ||
                      t("admin.matches.ngoFallback", {
                        defaultValue: "Organization unavailable",
                      })}
                  </span>
                </p>
                <p className="ngo-match-card__donation-id">
                  {t("admin.matches.donation", { defaultValue: "Donation" })} #
                  {String(donationId || "")
                    .slice(0, 8)
                    .toUpperCase() || "—"}
                </p>

                <div className="ngo-match-card__score">
                  <span>
                    {t("admin.matches.matchStrength", {
                      defaultValue: "Match strength",
                    })}
                  </span>
                  <strong>
                    {typeof match.score === "number" ? `${score}%` : "—"}
                  </strong>
                </div>
                <div
                  className="ngo-match-card__score-track"
                  role="progressbar"
                  aria-label={t("admin.matches.matchStrength", {
                    defaultValue: "Match strength",
                  })}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={score}
                >
                  <span
                    style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                  />
                </div>

                <div className="ngo-match-card__details">
                  <section>
                    <h3>
                      {t("admin.matches.donationItems", {
                        defaultValue: "Donation items",
                      })}
                    </h3>
                    {items.length ? (
                      items.map((item, index) => (
                        <p key={`${item.class_name}-${index}`}>
                          {t(
                            `categories.${String(item.category || item.class_name || "").toLowerCase()}`,
                            {
                              defaultValue:
                                item.category ||
                                item.class_name ||
                                t("admin.matches.itemFallback", {
                                  defaultValue: "Item",
                                }),
                            },
                          )}
                          {item.subcategory
                            ? ` / ${t(`categories.${String(item.subcategory).toLowerCase()}`, { defaultValue: item.subcategory })}`
                            : ""}
                          <span>
                            {t("admin.matches.quantity", {
                              defaultValue: "Qty",
                            })}
                            : {item.quantity}
                          </span>
                        </p>
                      ))
                    ) : (
                      <p>
                        {t("admin.matches.itemsUnavailable", {
                          defaultValue: "Donation items unavailable",
                        })}
                      </p>
                    )}
                  </section>
                  {match.requirements?.length ? (
                    <section>
                      <h3>
                        {t("admin.matches.ngoDemand", {
                          defaultValue: "NGO demand",
                        })}
                      </h3>
                      {match.requirements.map((demand, index) => (
                        <p key={`${demand.category}-${index}`}>
                          {t(
                            `categories.${String(demand.category || "").toLowerCase()}`,
                            { defaultValue: demand.category },
                          )}
                          {demand.subcategory
                            ? ` / ${t(`categories.${String(demand.subcategory).toLowerCase()}`, { defaultValue: demand.subcategory })}`
                            : ""}
                          <span>
                            {t("admin.matches.quantity", {
                              defaultValue: "Qty",
                            })}
                            : {demand.quantity_needed}
                          </span>
                        </p>
                      ))}
                    </section>
                  ) : null}
                </div>

                <div className="ngo-match-card__actions">
                  <button
                    type="button"
                    className="ngo-match-card__details-button"
                    onClick={() => openMatchDetails(match)}
                  >
                    {t("admin.matches.viewDetails", {
                      defaultValue: "View match details",
                    })}
                    <i className="fi fi-rr-arrow-right" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      <MatchDetailsModal
        match={selectedMatch}
        loading={loadingMatch}
        error={matchError}
        onClose={() => setSelectedMatch(null)}
      />
    </AdminShell>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import StatusBadge from "../../components/common/StatusBadge";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import DonationActions from "../../components/donations/DonationActions";
import DonorShell from "./DonorShell";
import { formatDonationItem } from "./donorUtils.js";
import DonorPageHeaderArtwork from "./DonorPageHeaderArtwork";
import "./DonorDonationsPage.css";

const getDonationIcon = (items = []) => {
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

export default function DonorDonationsPage() {
  const { t, i18n } = useTranslation();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/donations")
      .then(setDonations)
      .catch(() => setError(t("errors.generic")))
      .finally(() => setLoading(false));
  }, [t]);

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleString(i18n.resolvedLanguage)
      : t("donor.donations.notScheduled");

  return (
    <DonorShell>
      <PageHeader
        eyebrow={t("navigation.donations")}
        title={t("donor.donations.title")}
        description={t("donor.donations.description")}
        action={<DonorPageHeaderArtwork />}
        actionClassName="donor-page-header-artwork-action"
      />
      {loading ? <LoadingState message={t("common.loading")} /> : null}
      {error ? (
        <ErrorMessage
          onRetry={() => {
            setLoading(true);
            setError("");
            api
              .get("/api/donations")
              .then(setDonations)
              .catch(() => setError(t("errors.generic")))
              .finally(() => setLoading(false));
          }}
        >
          {error}
        </ErrorMessage>
      ) : null}
      {!loading && !error && !donations.length ? (
        <div className="empty-state">
          {t("donor.donations.empty")} {t("donor.donations.emptyDesc")}
        </div>
      ) : null}
      {!loading && !error && donations.length ? (
        <div className="donor-donations-list">
          {donations.map((donation) => (
            <article key={donation.id} className="donor-donation-card">
              <div className="donor-donation-art" aria-hidden="true">
                <i className={`fi fi-rr-${getDonationIcon(donation.items)}`} />
              </div>
              <div className="donor-donation-info">
                <div className="donor-donation-heading">
                  <Link
                    className="donor-donation-id"
                    to={`/donor/donations/${donation.id}`}
                  >
                    {t("donor.donations.donationId", { id: donation.id })}
                  </Link>
                  <StatusBadge status={donation.status} />
                </div>
                <p className="donor-donation-meta">
                  <i className="fi fi-rr-box" aria-hidden="true" />
                  <span>
                    <strong>{t("donor.donations.itemsLabel")}:</strong>{" "}
                    {donation.items
                      ?.map((item) => formatDonationItem(item, t))
                      .join(", ") || t("donor.donations.noItems")}
                  </span>
                </p>
                <p className="donor-donation-meta">
                  <i className="fi fi-rr-calendar" aria-hidden="true" />
                  <span>
                    <strong>{t("donor.donations.createdLabel")}:</strong>{" "}
                    {formatDate(donation.created_at)}
                  </span>
                </p>
                <div className="donor-donation-actions">
                  <DonationActions
                    donation={donation}
                    role="donor"
                    onUpdated={(updated) =>
                      setDonations((current) =>
                        current.map((item) =>
                          item.id === updated.id ? updated : item,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </DonorShell>
  );
}

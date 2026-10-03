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
import "./DonorPickupPage.css";

const getPickupIcon = (items = []) => {
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

export default function DonorPickupPage() {
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

  const pickupDonations = donations.filter((donation) =>
    [
      "matched",
      "packaging_notified",
      "pickup_scheduled",
      "collected",
      "delivered",
      "acknowledged",
    ].includes(donation.status),
  );

  return (
    <DonorShell>
      <PageHeader
        eyebrow={t("navigation.pickup")}
        title={t("donor.pickup.title")}
        description={t("donor.pickup.description")}
        action={<DonorPageHeaderArtwork />}
        actionClassName="donor-page-header-artwork-action"
      />
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {loading ? <LoadingState message={t("common.loading")} /> : null}
      {!loading && !pickupDonations.length ? (
        <div className="empty-state">
          {t("donor.pickup.empty")} {t("donor.pickup.emptyDesc")}
        </div>
      ) : null}
      {!loading && pickupDonations.length ? (
        <div className="donor-pickups-list">
          {pickupDonations.map((donation) => (
            <article key={donation.id} className="donor-pickup-card">
              <div className="donor-pickup-art" aria-hidden="true">
                <i className={`fi fi-rr-${getPickupIcon(donation.items)}`} />
              </div>
              <div className="donor-pickup-info">
                <div className="donor-pickup-heading">
                  <Link
                    className="donor-pickup-id"
                    to={`/donor/donations/${donation.id}`}
                  >
                    {t("donor.donations.donationId", {
                      id: String(donation.id).slice(0, 8).toUpperCase(),
                    })}
                  </Link>
                  <StatusBadge status={donation.status} />
                </div>
                <p className="donor-pickup-meta">
                  <i className="fi fi-rr-box" aria-hidden="true" />
                  <span>
                    <strong>{t("donor.pickup.itemsLabel")}:</strong>{" "}
                    {(donation.items || [])
                      .map((item) => formatDonationItem(item, t))
                      .join(", ") || t("donor.pickup.noItems")}
                  </span>
                </p>
                <p className="donor-pickup-meta">
                  <i className="fi fi-rr-calendar" aria-hidden="true" />
                  <span>
                    <strong>{t("donor.pickup.dateLabel")}:</strong>{" "}
                    {donation.pickup_scheduled_at
                      ? new Date(donation.pickup_scheduled_at).toLocaleString(
                          i18n.resolvedLanguage,
                        )
                      : t("donor.pickup.pending")}
                  </span>
                </p>
                <Link
                  className="donor-pickup-details"
                  to={`/donor/donations/${donation.id}`}
                >
                  <span>{t("donor.pickup.viewDetails")}</span>
                  <i className="fi fi-rr-arrow-right" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </DonorShell>
  );
}

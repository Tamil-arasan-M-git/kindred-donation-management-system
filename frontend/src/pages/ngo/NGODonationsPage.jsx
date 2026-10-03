import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import StatusBadge from "../../components/common/StatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import DonorPageHeaderArtwork from "../donor/DonorPageHeaderArtwork";
import { formatDonationItem } from "../donor/donorUtils";
import NGOShell from "./NGOShell";
import "./NGODonationsPage.css";

const FILTERS = ["all", "matched", "acknowledged", "inProgress"];
const IN_PROGRESS_STATUSES = new Set([
  "packaging_notified",
  "pickup_scheduled",
  "picked_up",
  "collected",
  "delivered",
  "in_progress",
]);

function categoryKey(value) {
  const normalized = String(value || "other")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const aliases = {
    electronic: "electronics",
    clothing: "clothing",
    clothes: "clothing",
    book: "books",
    toy: "toys",
    utensil: "utensils",
  };
  return aliases[normalized] || normalized;
}

function categoryIcon(value) {
  const key = categoryKey(value);
  if (key === "electronics") return "laptop";
  if (key === "books") return "book-open-cover";
  if (key === "clothing") return "shirt";
  if (key === "furniture") return "couch";
  if (key === "food" || key === "utensils") return "utensils";
  if (key === "toys") return "gamepad";
  return "box-open";
}

function matchesFilter(donation, filter) {
  if (filter === "all") return true;
  if (filter === "matched") return donation.status === "matched";
  if (filter === "acknowledged") return donation.status === "acknowledged";
  return IN_PROGRESS_STATUSES.has(donation.status);
}

export default function NGODonationsPage() {
  const { t, i18n } = useTranslation();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadDonations = () => {
    setLoading(true);
    setError("");
    api
      .get("/api/donations")
      .then((result) => setDonations(Array.isArray(result) ? result : []))
      .catch(() => setError(t("errors.generic")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDonations();
  }, []);

  const visibleDonations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return donations.filter((donation) => {
      if (!matchesFilter(donation, filter)) return false;
      if (!query) return true;
      const searchable = [
        donation.id,
        ...(Array.isArray(donation.items) ? donation.items : []).flatMap(
          (item) => [item.category, item.class_name, item.subcategory],
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [donations, filter, search]);

  const formatDate = (value) => {
    if (!value) return t("ngo.donations.dateUnavailable");
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? t("ngo.donations.dateUnavailable")
      : date.toLocaleString(i18n.resolvedLanguage, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
  };

  const renderDonationCard = (donation) => {
    const items = Array.isArray(donation.items) ? donation.items : [];
    const thumbnailValue =
      donation.image_url ||
      donation.image ||
      items.find((item) => item.image_url || item.image)?.image_url ||
      items.find((item) => item.image)?.image;
    const thumbnail =
      typeof thumbnailValue === "string" ? thumbnailValue : thumbnailValue?.url;
    const totalQuantity = items.reduce(
      (total, item) => total + (Number(item.quantity) || 0),
      0,
    );

    return (
      <article className="ngo-donation-card" key={donation.id}>
        <div className="ngo-donation-card__thumb" aria-hidden="true">
          {thumbnail ? (
            <img src={thumbnail} alt="" loading="lazy" />
          ) : (
            <i
              className={`fi fi-rr-${categoryIcon(items[0]?.category || items[0]?.class_name)}`}
            />
          )}
        </div>

        <div className="ngo-donation-card__item-info">
          <Link
            className="ngo-donation-card__title"
            to={`/ngo/donations/${donation.id}`}
          >
            {t("ngo.donations.donationId", {
              id: String(donation.id || "")
                .slice(0, 8)
                .toUpperCase(),
            })}
          </Link>
          <p className="ngo-donation-card__summary">
            {items.length
              ? items.map((item) => formatDonationItem(item, t)).join(", ")
              : t("ngo.donations.itemsUnavailable")}
          </p>
          {items.length ? (
            <div className="ngo-donation-card__tags">
              {items.slice(0, 3).map((item, index) => {
                const category = item.category || item.class_name;
                return (
                  <span
                    className={`ngo-donation-tag ngo-donation-tag--${categoryKey(category)}`}
                    key={`${category}-${item.subcategory || index}`}
                  >
                    <i
                      className={`fi fi-rr-${categoryIcon(category)}`}
                      aria-hidden="true"
                    />
                    {t(`categories.${categoryKey(category)}`, {
                      defaultValue: category || t("categories.other"),
                    })}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="ngo-donation-card__meta">
          <div className="ngo-donation-card__meta-row">
            <i className="fi fi-rr-calendar" aria-hidden="true" />
            <div>
              <strong>{t("ngo.donations.received")}</strong>
              <span>{formatDate(donation.created_at)}</span>
            </div>
          </div>
          <div className="ngo-donation-card__meta-row">
            <i className="fi fi-rr-gift" aria-hidden="true" />
            <div>
              <strong>{t("ngo.donations.quantity")}</strong>
              <span>
                {t("ngo.donations.itemCount", { count: totalQuantity })}
              </span>
            </div>
          </div>
        </div>

        <div className="ngo-donation-card__actions">
          <StatusBadge status={donation.status} />
          <Link
            to={`/ngo/donations/${donation.id}`}
            className="ngo-donation-card__view"
          >
            {t("ngo.donations.viewDetails")}
          </Link>
        </div>

        <Link
          to={`/ngo/donations/${donation.id}`}
          className="ngo-donation-card__arrow"
          aria-label={t("ngo.donations.openDonation", {
            id: String(donation.id || "")
              .slice(0, 8)
              .toUpperCase(),
          })}
        >
          <i className="fi fi-rr-angle-right" aria-hidden="true" />
        </Link>
      </article>
    );
  };

  return (
    <NGOShell>
      <PageHeader
        eyebrow={t("navigation.donations")}
        title={t("ngo.donations.title")}
        description={t("ngo.donations.description")}
        action={<DonorPageHeaderArtwork />}
        actionClassName="donor-page-header-artwork-action"
      />

      <section
        className="ngo-donations-toolbar"
        aria-label={t("ngo.donations.controlsLabel")}
      >
        <div
          className="ngo-donations-filters"
          role="group"
          aria-label={t("ngo.donations.filterLabel")}
        >
          {FILTERS.map((value) => (
            <button
              type="button"
              key={value}
              className={`ngo-donations-filter${filter === value ? " is-active" : ""}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {t(`ngo.donations.filters.${value}`)}
            </button>
          ))}
        </div>
        <label className="ngo-donations-search">
          <i className="fi fi-rr-search" aria-hidden="true" />
          <span className="sr-only">{t("ngo.donations.searchLabel")}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("ngo.donations.searchPlaceholder")}
          />
        </label>
      </section>

      {error ? (
        <ErrorMessage onRetry={loadDonations}>{error}</ErrorMessage>
      ) : null}
      {loading ? <LoadingState message={t("common.loading")} /> : null}
      {!loading && !error && donations.length === 0 ? (
        <EmptyState title={t("ngo.donations.empty")}>
          {t("ngo.donations.emptyDesc")}
        </EmptyState>
      ) : null}
      {!loading &&
      !error &&
      donations.length > 0 &&
      visibleDonations.length === 0 ? (
        <EmptyState title={t("ngo.donations.noResults")}>
          {t("ngo.donations.noResultsDesc")}
        </EmptyState>
      ) : null}
      {!loading && !error && visibleDonations.length > 0 ? (
        <div className="ngo-donations-list">
          {visibleDonations.map(renderDonationCard)}
        </div>
      ) : null}
    </NGOShell>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import AdminShell from "./AdminShell";
import DonationDetailsDrawer from "../../components/admin/DonationDetailsDrawer";
import donationsBanner from "../../assets/admin-donations-reference-transparent.png";
import "./AdminDonationsPage.css";

const asList = (payload) => (Array.isArray(payload) ? payload : payload?.donations || []);
const itemOf = (donation) => donation.items?.[0] || {};
const donationCategory = (donation) => itemOf(donation).category || itemOf(donation).class_name || "Other";
const donationSubcategory = (donation) => itemOf(donation).subcategory || "Not specified";
const donationQuantity = (donation) => donation.items?.reduce((total, item) => total + (Number(item.quantity) || 0), 0) || 0;
const donationIcon = (category = "") => {
  const value = String(category).toLowerCase();
  if (value.includes("electronic") || value.includes("phone")) return "laptop";
  if (value.includes("book") || value.includes("education")) return "book-alt";
  if (value.includes("cloth") || value.includes("wear")) return "shirt";
  if (value.includes("food") || value.includes("utensil")) return "utensils";
  if (value.includes("furniture")) return "couch";
  return "box-open";
};
const donationIconTone = (category = "") => {
  const value = String(category).toLowerCase();
  if (value.includes("book")) return "blue";
  if (value.includes("cloth") || value.includes("wear")) return "pink";
  if (value.includes("food") || value.includes("utensil")) return "orange";
  return "green";
};
const statusLabel = (status, t) => t(`status.${status}`, { defaultValue: status || "Unknown" });
const displayName = (value, fallback) => typeof value === "string" ? value : value?.name || value?.full_name || value?.email || fallback;
const dateValue = (donation) => donation.created_at || donation.submitted_at || donation.updated_at;

export default function AdminDonationsPage() {
  const { t, i18n } = useTranslation();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [ngo, setNgo] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedDonationId, setSelectedDonationId] = useState(null);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadDonations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDonations(asList(await api.getDonations()));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadDonations();
  }, [loadDonations]);

  const categories = useMemo(
    () => [...new Set(donations.map(donationCategory).filter(Boolean))].sort(),
    [donations],
  );
  const ngos = useMemo(
    () => [...new Set(donations.map((donation) => displayName(donation.ngo, donation.ngo_name)).filter(Boolean))].sort(),
    [donations],
  );
  const visibleDonations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return donations.filter((donation) => {
      const ngoName = displayName(donation.ngo, donation.ngo_name) || "";
      const donorName = displayName(donation.donor, donation.donor_name) || "";
      const searchable = `${donation.id || ""} ${ngoName} ${donorName} ${donationCategory(donation)} ${donationSubcategory(donation)} ${donation.status || ""}`.toLowerCase();
      const created = dateValue(donation);
      const date = created ? new Date(created) : null;
      const dateString = date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
      return (!needle || searchable.includes(needle)) &&
        (status === "all" || donation.status === status) &&
        (category === "all" || donationCategory(donation) === category) &&
        (ngo === "all" || ngoName === ngo) &&
        (!fromDate || dateString >= fromDate) &&
        (!toDate || dateString <= toDate);
    });
  }, [category, donations, fromDate, ngo, query, status, toDate]);

  const summary = useMemo(() => ({
    total: donations.length,
    submitted: donations.filter((donation) => donation.status === "submitted").length,
    transit: donations.filter((donation) => ["pickup_scheduled", "collected", "delivered"].includes(donation.status)).length,
    acknowledged: donations.filter((donation) => donation.status === "acknowledged").length,
    cancelled: donations.filter((donation) => donation.status === "cancelled").length,
  }), [donations]);
  const dateFormat = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const clearFilters = () => { setQuery(""); setStatus("all"); setCategory("all"); setNgo("all"); setFromDate(""); setToDate(""); };
  const loadDonationDetails = useCallback(async (donationId) => {
    setSelectedDonationId(donationId);
    setSelectedDonation(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      setSelectedDonation(await api.getAdminDonationDetail(donationId));
    } catch (err) {
      setDetailError(t("errors.generic"));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);
  const closeDonationDetails = () => { setSelectedDonationId(null); setSelectedDonation(null); setDetailError(""); };

  return (
    <AdminShell>
      <div className="admin-donations-page">
        <PageHeader
          eyebrow={t("navigation.donations")}
          title={t("admin.donations.title")}
          description={t("admin.donations.description", { defaultValue: "Platform donation records with status, NGO, and impact details." })}
          action={<img className="admin-donations-banner" src={donationsBanner} alt="" aria-hidden="true" />}
        />

        <section className="admin-donations-stats" aria-label={t("admin.donations.summary", { defaultValue: "Donation summary" })}>
          <article className="admin-donation-stat stat-green"><span className="admin-donation-stat-icon"><i className="fi fi-rr-box" /></span><div><span>{t("admin.donations.total", { defaultValue: "Total Donations" })}</span><strong>{summary.total}</strong></div></article>
          <article className="admin-donation-stat stat-blue"><span className="admin-donation-stat-icon"><i className="fi fi-rr-paper-plane" /></span><div><span>{t("status.submitted", { defaultValue: "Submitted" })}</span><strong>{summary.submitted}</strong></div></article>
          <article className="admin-donation-stat stat-orange"><span className="admin-donation-stat-icon"><i className="fi fi-rr-truck-side" /></span><div><span>{t("admin.donations.inTransit", { defaultValue: "In Transit" })}</span><small>{t("admin.donations.inTransitHint", { defaultValue: "Collected / Delivered" })}</small><strong>{summary.transit}</strong></div></article>
          <article className="admin-donation-stat stat-green"><span className="admin-donation-stat-icon"><i className="fi fi-rr-check" /></span><div><span>{t("status.acknowledged", { defaultValue: "Acknowledged" })}</span><strong>{summary.acknowledged}</strong></div></article>
          <article className="admin-donation-stat stat-red"><span className="admin-donation-stat-icon"><i className="fi fi-rr-cross-circle" /></span><div><span>{t("status.cancelled", { defaultValue: "Cancelled" })}</span><strong>{summary.cancelled}</strong></div></article>
        </section>

        <section className="admin-donations-filters" aria-label={t("admin.donations.filters", { defaultValue: "Donation filters" })}>
          <label className="admin-donations-search"><i className="fi fi-rr-search" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("admin.donations.search", { defaultValue: "Search by donation ID, NGO, donor, item, or status..." })} aria-label={t("admin.donations.search", { defaultValue: "Search donations" })} /></label>
          <label><span>{t("admin.donations.statusFilter", { defaultValue: "Status" })}</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t("admin.donations.allStatuses", { defaultValue: "All status" })}</option>{["submitted", "matched", "pickup_scheduled", "collected", "delivered", "acknowledged", "cancelled"].map((value) => <option key={value} value={value}>{statusLabel(value, t)}</option>)}</select></label>
          <label><span>{t("admin.donations.categoryFilter", { defaultValue: "Category" })}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">{t("admin.donations.allCategories", { defaultValue: "All categories" })}</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>{t("admin.donations.ngoFilter", { defaultValue: "NGO" })}</span><select value={ngo} onChange={(event) => setNgo(event.target.value)}><option value="all">{t("admin.donations.allNgos", { defaultValue: "All NGOs" })}</option>{ngos.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>{t("admin.donations.dateRange", { defaultValue: "Date range" })}</span><div className="admin-donation-date-range"><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label={t("admin.donations.fromDate", { defaultValue: "From date" })} /><span>→</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label={t("admin.donations.toDate", { defaultValue: "To date" })} /></div></label>
          <button type="button" className="admin-donations-clear" onClick={clearFilters}>{t("common.clear", { defaultValue: "Clear" })}</button>
        </section>

        {loading ? <LoadingState message={t("common.loading")} /> : null}
        {error ? <ErrorMessage onRetry={loadDonations}>{error}</ErrorMessage> : null}
        {!loading && !error && !visibleDonations.length ? <EmptyState title={donations.length ? t("admin.donations.noResults", { defaultValue: "No donations match your filters" }) : t("admin.donations.empty")} /> : null}
        {!loading && !error && visibleDonations.length ? <section className="admin-donation-list">{visibleDonations.map((donation) => {
          const item = itemOf(donation);
          const categoryName = donationCategory(donation);
          const created = dateValue(donation);
          const date = created ? new Date(created) : null;
          const donorName = displayName(donation.donor, donation.donor_name) || t("admin.donations.unknownDonor", { defaultValue: "Unknown donor" });
          const ngoName = displayName(donation.ngo, donation.ngo_name) || t("admin.donations.unknownNgo", { defaultValue: "Unknown NGO" });
          return <article className="admin-donation-row" key={donation.id}>
            <div className={`admin-donation-item-art tone-${donationIconTone(categoryName)}`}>{item.image_url || item.image || item.thumbnail ? <img src={item.image_url || item.image || item.thumbnail} alt={categoryName} /> : <i className={`fi fi-rr-${donationIcon(categoryName)}`} aria-hidden="true" />}</div>
            <div className="admin-donation-main"><div className="admin-donation-title"><h2>{t("admin.donations.donationId", { defaultValue: "Donation" })} #{String(donation.id || "").slice(0, 8)}</h2><span className={`admin-donation-status status-${donation.status || "submitted"}`}>{statusLabel(donation.status, t)}</span></div><p className="admin-donation-item-summary">{categoryName} / {donationSubcategory(donation)} · {t("admin.donations.quantity", { defaultValue: "Quantity" })}: {donationQuantity(donation)}</p><span className={`admin-donation-category-pill tone-${donationIconTone(categoryName)}`}>{categoryName}</span></div>
            <div className="admin-donation-people"><div><i className="fi fi-rr-user" /><span><small>{t("admin.donations.donor", { defaultValue: "Donor" })}</small><strong>{donorName}</strong><em>{donation.donor?.email || donation.donor_email || ""}</em></span></div><div><i className="fi fi-rr-building" /><span><small>{t("admin.donations.ngo", { defaultValue: "NGO" })}</small><strong>{ngoName}</strong><em>{donation.ngo?.city || donation.ngo_city || ""}</em></span></div><div><i className="fi fi-rr-calendar" /><span><small>{t("admin.donations.submittedOn", { defaultValue: "Submitted on" })}</small><strong>{date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : t("admin.donations.notAvailable", { defaultValue: "Not available" })}</strong></span></div></div>
            <button type="button" className="admin-donation-details-button" onClick={() => loadDonationDetails(donation.id)}><span>{t("admin.donations.viewDetails", { defaultValue: "View Details" })}</span><i className="fi fi-rr-arrow-right" /></button>
          </article>;
        })}</section> : null}
        <DonationDetailsDrawer donationId={selectedDonationId} detail={selectedDonation} loading={detailLoading} error={detailError} onRetry={() => selectedDonationId && loadDonationDetails(selectedDonationId)} onClose={closeDonationDetails} />
      </div>
    </AdminShell>
  );
}

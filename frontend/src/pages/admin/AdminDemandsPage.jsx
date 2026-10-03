import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import DemandDetailsDrawer from "../../components/admin/DemandDetailsDrawer";
import PageHeader from "../../components/layout/PageHeader";
import AdminShell from "./AdminShell";
import demandsBanner from "../../assets/admin-demands-reference.png";
import "./AdminDemandsPage.css";

const categoryIcon = (category = "") => {
  const value = String(category).toLowerCase();
  if (value.includes("electronic")) return "fi-rr-laptop";
  if (value.includes("book")) return "fi-rr-book-alt";
  if (value.includes("cloth")) return "fi-rr-shirt";
  if (value.includes("food") || value.includes("utensil")) return "fi-rr-utensils";
  if (value.includes("furniture")) return "fi-rr-couch";
  return "fi-rr-box-open";
};

const categoryTone = (category = "") => {
  const value = String(category).toLowerCase();
  if (value.includes("electronic")) return "orange";
  if (value.includes("book")) return "blue";
  if (value.includes("cloth")) return "pink";
  return "green";
};

const priorityLabel = (priority, t) => {
  const key = { 1: "low", 2: "belowAverage", 3: "normal", 4: "high", 5: "urgent" }[priority] || "normal";
  return t(`ngo.demands.priorityLabels.${key}`, { defaultValue: key });
};

const fulfillmentValues = (demand) => {
  const needed = Number(demand.quantity_needed) || 0;
  const fulfilled = Number(demand.quantity_fulfilled) || 0;
  const remaining = Math.max(0, Number(demand.quantity_remaining ?? needed) || 0);
  const percentage = needed > 0
    ? Math.min(100, Math.max(0, (fulfilled / needed) * 100))
    : 0;
  return {
    needed,
    fulfilled,
    remaining,
    percentage,
    status: demand.fulfillment_status || "active",
  };
};

const fulfillmentStatusLabel = (status, t) => {
  const labels = {
    active: t("admin.demands.statusActive", { defaultValue: "Active" }),
    partially_fulfilled: t("admin.demands.statusPartiallyFulfilled", { defaultValue: "Partially Fulfilled" }),
    fulfilled: t("admin.demands.statusFulfilled", { defaultValue: "Fulfilled" }),
    expired: t("admin.demands.statusExpired", { defaultValue: "Expired" }),
  };
  return labels[status] || labels.active;
};

const fulfillmentStatusClass = (status) =>
  ["active", "partially_fulfilled", "fulfilled", "expired"].includes(status)
    ? status
    : "active";

export default function AdminDemandsPage() {
  const { t, i18n } = useTranslation();
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [ngo, setNgo] = useState("all");
  const [priority, setPriority] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("newest");
  const [ngosById, setNgosById] = useState({});
  const [selectedDemand, setSelectedDemand] = useState(null);

  const loadDemands = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ngos = await api.get("/api/ngos");
      setNgosById(Object.fromEntries(ngos.map((organization) => [organization.id, organization])));
      const lists = await Promise.all(
        ngos.map(async (organization) =>
          (await api.get(`/api/ngos/${organization.id}/demands`)).map((demand) => ({
            ...demand,
            ngo_id: organization.id,
            ngo_name: organization.name,
          })),
        ),
      );
      setDemands(lists.flat());
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadDemands();
  }, [loadDemands]);

  const categories = useMemo(
    () => [...new Set(demands.map((item) => item.class_name).filter(Boolean))].sort(),
    [demands],
  );
  const ngos = useMemo(
    () => [...new Map(demands.map((item) => [item.ngo_id, item.ngo_name])).entries()].filter(([, name]) => name),
    [demands],
  );
  const visibleDemands = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return demands
      .filter((item) => {
        const haystack = `${item.ngo_name || ""} ${item.class_name || ""} ${item.subcategory || ""}`.toLowerCase();
        const created = item.created_at ? new Date(item.created_at) : null;
        const createdDate = created && !Number.isNaN(created.getTime()) ? created.toISOString().slice(0, 10) : "";
        return (
          (!needle || haystack.includes(needle)) &&
          (category === "all" || item.class_name === category) &&
          (ngo === "all" || item.ngo_id === ngo) &&
          (priority === "all" || String(item.priority) === priority) &&
          (!fromDate || createdDate >= fromDate) &&
          (!toDate || createdDate <= toDate)
        );
      })
      .sort((a, b) => sort === "priority"
        ? Number(b.priority || 0) - Number(a.priority || 0)
        : new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [category, demands, fromDate, ngo, priority, query, sort, toDate]);

  const uniqueNgoCount = new Set(demands.map((item) => item.ngo_id).filter(Boolean)).size;
  const openCount = demands.filter((item) => item.fulfillment_status !== "fulfilled").length;
  const fulfilledCount = demands.filter((item) => item.fulfillment_status === "fulfilled").length;
  const clearFilters = () => {
    setQuery(""); setCategory("all"); setNgo("all"); setPriority("all");
    setFromDate(""); setToDate(""); setSort("newest");
  };
  const dateFormat = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <AdminShell>
      <div className="admin-demands-page">
        <PageHeader
          eyebrow={t("navigation.demands")}
          title={t("admin.demands.title")}
          description={t("admin.demands.description", { defaultValue: "View and manage resource requests from all registered NGOs." })}
          action={<img className="admin-demands-banner" src={demandsBanner} alt="" aria-hidden="true" />}
        />
        <section className="admin-demands-stats" aria-label={t("admin.demands.summary", { defaultValue: "Demand summary" })}>
          <article className="admin-demand-stat stat-green"><span className="admin-demand-stat-icon"><i className="fi fi-rr-document" /></span><div><span>{t("admin.demands.total", { defaultValue: "Total Demands" })}</span><strong>{demands.length}</strong></div></article>
          <article className="admin-demand-stat stat-amber"><span className="admin-demand-stat-icon"><i className="fi fi-rr-clock" /></span><div><span>{t("admin.demands.open", { defaultValue: "Open Demands" })}</span><strong>{openCount}</strong></div></article>
          <article className="admin-demand-stat stat-green"><span className="admin-demand-stat-icon"><i className="fi fi-rr-check" /></span><div><span>{t("admin.demands.fulfilled", { defaultValue: "Fulfilled Demands" })}</span><strong>{fulfilledCount}</strong></div></article>
          <article className="admin-demand-stat stat-blue"><span className="admin-demand-stat-icon"><i className="fi fi-rr-users" /></span><div><span>{t("admin.demands.uniqueNgos", { defaultValue: "Unique NGOs" })}</span><strong>{uniqueNgoCount}</strong></div></article>
        </section>
        <section className="admin-demands-filters" aria-label={t("admin.demands.filtersLabel", { defaultValue: "Demand filters" })}>
          <div className="admin-demands-search"><i className="fi fi-rr-search" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("admin.demands.search", { defaultValue: "Search NGOs, categories, subcategories..." })} aria-label={t("admin.demands.search", { defaultValue: "Search demands" })} /></div>
          <label className="admin-demand-sort">{t("admin.demands.sortBy", { defaultValue: "Sort by" })}<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">{t("admin.demands.newest", { defaultValue: "Newest" })}</option><option value="priority">{t("admin.demands.prioritySort", { defaultValue: "Priority" })}</option></select></label>
          <div className="admin-demands-filter-row">
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t("admin.demands.categoryFilter", { defaultValue: "Filter by category" })}><option value="all">{t("admin.demands.allCategories", { defaultValue: "All Categories" })}</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select value={ngo} onChange={(event) => setNgo(event.target.value)} aria-label={t("admin.demands.ngoFilter", { defaultValue: "Filter by NGO" })}><option value="all">{t("admin.demands.allNgos", { defaultValue: "All NGOs" })}</option>{ngos.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label={t("admin.demands.priorityFilter", { defaultValue: "Filter by priority" })}><option value="all">{t("admin.demands.allPriorities", { defaultValue: "All Priorities" })}</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} - {priorityLabel(value, t)}</option>)}</select>
            <label className="admin-demand-date"><span>{t("admin.demands.fromDate", { defaultValue: "From date" })}</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label className="admin-demand-date"><span>{t("admin.demands.toDate", { defaultValue: "To date" })}</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
            <button type="button" className="admin-demand-clear" onClick={clearFilters}>{t("common.clear", { defaultValue: "Clear" })}</button>
          </div>
        </section>
        {loading ? <LoadingState message={t("common.loading")} /> : null}
        {error ? <ErrorMessage onRetry={loadDemands}>{error}</ErrorMessage> : null}
        {!loading && !error && !visibleDemands.length ? <EmptyState title={t("admin.demands.empty")} /> : null}
        {!loading && !error && visibleDemands.length ? <section className="admin-demand-grid">{visibleDemands.map((demand) => {
          const date = demand.created_at ? new Date(demand.created_at) : null;
          const tone = categoryTone(demand.class_name);
          const fulfillment = fulfillmentValues(demand);
          return <article className="admin-demand-card" key={demand.id}>
            <header className="admin-demand-card-header"><div className="admin-demand-ngo-avatar">{String(demand.ngo_name || "NG").slice(0, 2).toUpperCase()}</div><div><strong>{demand.ngo_name || t("admin.demands.unknownNgo", { defaultValue: "Unknown NGO" })}</strong><span>{t("admin.demands.requested", { defaultValue: "Requested" })} {date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : "—"}</span></div><button type="button" className="admin-demand-more" aria-label={t("admin.demands.more", { defaultValue: "More options" })}>⋮</button></header>
            <div className="admin-demand-card-title"><span className={`admin-demand-category-icon tone-${tone}`}><i className={`fi ${categoryIcon(demand.class_name)}`} /></span><div><h2>{demand.class_name || t("categories.other")}</h2><p>{t("ngo.demands.subcategory", { defaultValue: "Subcategory" })}: {demand.subcategory || t("ngo.demands.notSpecified", { defaultValue: "Not specified" })}</p></div><span className="admin-demand-arrow">›</span></div>
            <div className="admin-demand-details"><p><i className="fi fi-rr-box" /> <span>{t("ngo.demands.quantityNeeded", { defaultValue: "Required quantity" })}</span><strong>{fulfillment.needed}</strong></p><p><i className="fi fi-rr-check" /> <span>{t("ngo.demands.fulfilled", { defaultValue: "Fulfilled" })}</span><strong>{fulfillment.fulfilled}</strong></p><p><i className="fi fi-rr-box-open" /> <span>{t("ngo.demands.remaining", { defaultValue: "Remaining" })}</span><strong>{fulfillment.remaining}</strong></p><p><i className="fi fi-rr-flag" /> <span>{t("ngo.demands.priority", { defaultValue: "Priority" })}</span><strong className={`priority-${demand.priority >= 5 ? "urgent" : demand.priority >= 4 ? "high" : "normal"}`}>{demand.priority} - {priorityLabel(demand.priority, t)}</strong></p><p><i className="fi fi-rr-calendar" /> <span>{t("ngo.demands.neededUntil", { defaultValue: "Needed Until" })}</span><strong>{demand.expiry_date || t("ngo.demands.noExpiry", { defaultValue: "No expiry" })}</strong></p></div>
            <div className="admin-demand-fulfillment"><div className="admin-demand-fulfillment-heading"><span>{t("admin.demands.fulfillment", { defaultValue: "Fulfillment" })}</span><strong className={`admin-demand-status admin-demand-status-${fulfillmentStatusClass(fulfillment.status)}`}>{fulfillmentStatusLabel(fulfillment.status, t)}</strong></div><div className="admin-demand-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(fulfillment.percentage)} aria-label={`${Math.round(fulfillment.percentage)}% fulfilled`}><span style={{ width: `${fulfillment.percentage}%` }} /></div><span className="admin-demand-progress-label">{Math.round(fulfillment.percentage)}% {t("ngo.demands.fulfilled", { defaultValue: "fulfilled" }).toLowerCase()}</span></div>
            <button type="button" className="admin-demand-details-button" onClick={() => setSelectedDemand(demand)}><i className="fi fi-rr-eye" />{t("admin.demands.viewDetails", { defaultValue: "View Details" })}</button>
          </article>;
        })}</section> : null}
        <DemandDetailsDrawer
          demand={selectedDemand}
          ngo={selectedDemand ? ngosById[selectedDemand.ngo_id] : null}
          onClose={() => setSelectedDemand(null)}
        />
      </div>
    </AdminShell>
  );
}

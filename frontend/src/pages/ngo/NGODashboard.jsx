import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import api from "../../api/client";
import NGOShell from "./NGOShell";
import { loadCurrentNgo } from "./ngoUtils";
import ngoBanner from "../../assets/ngo-dashboard-hero-reference.jpg";
import quickActionArt from "../../assets/ngo-dashboard-quick-art.png";
import impactCardArt from "../../assets/ngo-dashboard-impact-reference.jpg";
import "./NGODashboard.css";

const asList = (data, key) =>
  Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : [];
const iconFor = (name = "") => {
  const value = String(name).toLowerCase();
  if (value.includes("book") || value.includes("education")) return "book-alt";
  if (value.includes("electronic") || value.includes("phone")) return "laptop";
  if (value.includes("cloth")) return "shirt";
  if (value.includes("food") || value.includes("utensil")) return "utensils";
  return "box-open";
};
const fulfillmentValues = (demand) => ({
  needed: Number(demand.quantity_needed) || 0,
  fulfilled: Number(demand.quantity_fulfilled) || 0,
  status: demand.fulfillment_status || "active",
});

const fulfillmentStatusLabel = (status, t) => ({
  active: t("ngo.demands.statusActive", "Active"),
  partially_fulfilled: t("ngo.demands.statusPartiallyFulfilled", "Partially Fulfilled"),
  fulfilled: t("ngo.demands.statusFulfilled", "Fulfilled"),
  expired: t("ngo.demands.statusExpired", "Expired"),
}[status] || t("ngo.demands.statusActive", "Active"));

export default function NGODashboard() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [demands, setDemands] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const dashboard = await api.getNgoDashboard();
        if (!active) return;
        setSummary(dashboard);
      } catch (err) {
        if (active) setError(t("errors.generic"));
      }
      try {
        const ngo = await loadCurrentNgo(user?.email);
        const [demandResult, donationResult] = await Promise.allSettled([
          api.get(`/api/ngos/${ngo.id}/demands`),
          api.get("/api/donations"),
        ]);
        if (!active) return;
        if (demandResult.status === "fulfilled")
          setDemands(asList(demandResult.value, "demands"));
        if (donationResult.status === "fulfilled")
          setDonations(asList(donationResult.value, "donations"));
      } catch {
        // Keep the overview and its summary usable if these optional recent lists are unavailable.
      } finally {
        if (active) setLoading(false);
      }
    };
    if (user?.email) load();
    return () => {
      active = false;
    };
  }, [user?.email, t]);

  const summaryItems = [
    {
      label: t("ngo.demands.title"),
      value: summary?.active_demands ?? 0,
      icon: "document",
      color: "green",
      to: "/ngo/demands",
    },
    {
      label: t("ngo.matches.title"),
      value: summary?.incoming_matches ?? 0,
      icon: "users-alt",
      color: "blue",
      to: "/ngo/matches",
    },
    {
      label: t("status.accepted"),
      value: summary?.accepted_matches ?? 0,
      icon: "check",
      color: "amber",
      to: "/ngo/matches",
    },
    {
      label: t("ngo.donations.title"),
      value: summary?.active_donations ?? 0,
      icon: "box-open",
      color: "purple",
      to: "/ngo/donations",
    },
  ];
  const quickActions = [
    {
      to: "/ngo/demands",
      title: t("ngo.demands.title"),
      desc: t("ngo.dashboard.manageDemands"),
      icon: "document",
      color: "green",
    },
    {
      to: "/ngo/matches",
      title: t("ngo.matches.title"),
      desc: t("ngo.dashboard.reviewMatches"),
      icon: "users-alt",
      color: "blue",
    },
    {
      to: "/ngo/donations",
      title: t("ngo.donations.title"),
      desc: t("ngo.dashboard.trackDonations"),
      icon: "box-open",
      color: "amber",
    },
  ];
  const recentDemands = [...demands]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 3);
  const recentDonations = [...donations]
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0) -
        new Date(a.updated_at || a.created_at || 0),
    )
    .slice(0, 2);
  const dateFormat = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <NGOShell>
      <div className="ngo-dashboard">
        <section className="ngo-dashboard-hero">
          <div className="ngo-dashboard-hero-copy">
            <span className="ngo-dashboard-eyebrow">
              {t("ngo.dashboard.title")}
            </span>
            <h1>
              {t("ngo.dashboard.welcome")}
              {user?.name ? `, ${user.name.split(" ")[0]}` : "!"}
            </h1>
            <p>{t("ngo.dashboard.subtitle")}</p>
          </div>
          <div className="ngo-dashboard-hero-art">
            <img src={ngoBanner} alt="" />
            <Link
              to="/ngo/demands"
              className="ngo-dashboard-add-button"
              aria-label={t("ngo.demands.addDemand")}
              title={t("ngo.demands.addDemand")}
            />
          </div>
        </section>

        {loading && <LoadingState message={t("common.loading")} />}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {!loading && !error && (
          <>
            <section
              className="ngo-dashboard-stats"
              aria-label={t("ngo.dashboard.title")}
            >
              {summaryItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`ngo-dashboard-stat stat-${item.color}`}
                >
                  <span className="ngo-dashboard-stat-icon">
                    <i className={`fi fi-rr-${item.icon}`} aria-hidden="true" />
                  </span>
                  <span className="ngo-dashboard-stat-copy">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </span>
                  <span className="ngo-dashboard-stat-arrow">
                    <i
                      className="fi fi-rr-angle-small-right"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              ))}
            </section>

            <section className="ngo-dashboard-quick panel">
              <header className="ngo-dashboard-section-heading">
                <div>
                  <h2>{t("ngo.dashboard.quickActions")}</h2>
                  <p>{t("ngo.dashboard.quickActionsDesc")}</p>
                </div>
                <img
                  className="ngo-dashboard-quick-art"
                  src={quickActionArt}
                  alt=""
                  aria-hidden="true"
                />
              </header>
              <div className="ngo-dashboard-action-grid">
                {quickActions.map((action) => (
                  <Link
                    to={action.to}
                    key={action.to}
                    className={`ngo-dashboard-action action-${action.color}`}
                  >
                    <span className="ngo-dashboard-action-icon">
                      <i
                        className={`fi fi-rr-${action.icon}`}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="ngo-dashboard-action-copy">
                      <strong>{action.title}</strong>
                      <small>{action.desc}</small>
                    </span>
                    <span className="ngo-dashboard-action-arrow">
                      <i className="fi fi-rr-arrow-right" aria-hidden="true" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="ngo-dashboard-bottom-grid">
              <div className="panel ngo-dashboard-list-panel">
                <header className="ngo-dashboard-list-heading">
                  <h2>
                    <i className="fi fi-rr-document" aria-hidden="true" />
                    {t("ngo.dashboard.recentDemands")}
                  </h2>
                  <Link to="/ngo/demands">
                    {t("ngo.dashboard.viewAll")}{" "}
                    <i className="fi fi-rr-arrow-right" aria-hidden="true" />
                  </Link>
                </header>
                {recentDemands.length ? (
                  <div className="ngo-dashboard-recent-list">
                    {recentDemands.map((demand, index) => {
                      const fulfillment = fulfillmentValues(demand);
                      return (
                      <Link
                        to="/ngo/demands"
                        className="ngo-dashboard-recent-row"
                        key={demand.id || index}
                      >
                        <span
                          className={`ngo-dashboard-row-icon category-${iconFor(demand.class_name || demand.category)}`}
                        >
                          <i
                            className={`fi fi-rr-${iconFor(demand.class_name || demand.category)}`}
                            aria-hidden="true"
                          />
                        </span>
                        <span className="ngo-dashboard-row-main">
                          <strong>
                            {demand.class_name ||
                              demand.category ||
                              t("ngo.demands.title")}
                          </strong>
                          <small>
                            {demand.subcategory || t("ngo.dashboard.noSubcategory")} · {fulfillment.fulfilled} / {fulfillment.needed} {t("ngo.demands.fulfilled", "fulfilled").toLowerCase()}
                          </small>
                        </span>
                        <span className={`ngo-dashboard-demand-status status-${fulfillment.status}`}>
                          {fulfillmentStatusLabel(fulfillment.status, t)}
                        </span>
                        {demand.expiry_date && (
                          <time>
                            {dateFormat.format(new Date(demand.expiry_date))}
                          </time>
                        )}
                        <i
                          className="fi fi-rr-angle-small-right ngo-dashboard-row-chevron"
                          aria-hidden="true"
                        />
                      </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="ngo-dashboard-empty">
                    {t("ngo.demands.empty")}
                  </p>
                )}
              </div>
              <div className="panel ngo-dashboard-list-panel ngo-dashboard-donations-panel">
                <header className="ngo-dashboard-list-heading">
                  <h2>
                    <i className="fi fi-rr-box-open" aria-hidden="true" />
                    {t("ngo.dashboard.recentDonations")}
                  </h2>
                  <Link to="/ngo/donations">
                    {t("ngo.dashboard.viewAll")}{" "}
                    <i className="fi fi-rr-arrow-right" aria-hidden="true" />
                  </Link>
                </header>
                {recentDonations.length ? (
                  <div className="ngo-dashboard-recent-list">
                    {recentDonations.map((donation, index) => {
                      const item = donation.items?.[0] || {};
                      const label =
                        item.class_name ||
                        item.category ||
                        t("ngo.donations.title");
                      return (
                        <Link
                          to={`/ngo/donations/${donation.id}`}
                          className="ngo-dashboard-recent-row"
                          key={donation.id || index}
                        >
                          <span className="ngo-dashboard-row-icon category-donation">
                            <i
                              className={`fi fi-rr-${iconFor(label)}`}
                              aria-hidden="true"
                            />
                          </span>
                          <span className="ngo-dashboard-row-main">
                            <strong>{label}</strong>
                            <small>
                              {t("ngo.dashboard.quantity", {
                                count: item.quantity ?? item.count ?? 1,
                              })}
                            </small>
                          </span>
                          <span
                            className={`ngo-dashboard-status status-${String(
                              donation.status || "submitted",
                            )
                              .toLowerCase()
                              .replaceAll("_", "-")}`}
                          >
                            {t(
                              `status.${donation.status}`,
                              donation.status || t("ngo.dashboard.submitted"),
                            )}
                          </span>
                          <i
                            className="fi fi-rr-angle-small-right ngo-dashboard-row-chevron"
                            aria-hidden="true"
                          />
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="ngo-dashboard-empty">
                    {t("ngo.donations.empty")}
                  </p>
                )}
              </div>
              <aside className="ngo-dashboard-impact-card">
                <img
                  src={impactCardArt}
                  alt={t("ngo.dashboard.impactImageAlt")}
                />
              </aside>
            </section>
          </>
        )}
      </div>
    </NGOShell>
  );
}

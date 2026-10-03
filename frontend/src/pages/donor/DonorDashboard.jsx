import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/client";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import DonorShell from "./DonorShell";
import heroIllustration from "../../assets/donor-hero-illustration.png";
import quoteLeaves from "../../assets/donor-quote-leaves.png";
import { formatDonationItem } from "./donorUtils";
import "./DonorDashboard.css";

/* Flaticon UIcons used throughout the donor overview. */
const FlaticonIcon = ({ name, className = "" }) => (
  <i
    className={"fi fi-rr-" + name + " donor-flaticon-icon " + className}
    aria-hidden="true"
  />
);

const CameraIcon = () => <FlaticonIcon name="camera" />;
const BoxIcon = () => <FlaticonIcon name="box-open" />;
const UsersIcon = () => <FlaticonIcon name="users-alt" />;
const TruckIcon = () => <FlaticonIcon name="truck-side" />;
const CheckCircleIcon = () => <FlaticonIcon name="check-circle" />;
const GiftIcon = () => <FlaticonIcon name="gift" />;
const LeafIcon = () => <FlaticonIcon name="leaf" />;
const GlobeIcon = () => <FlaticonIcon name="globe" />;
const HeartIcon = () => <FlaticonIcon name="heart" />;
const ArrowRightIcon = () => (
  <FlaticonIcon name="arrow-right" className="donor-flaticon-arrow" />
);

function formatRelativeTime(dateStr, locale) {
  if (!dateStr) return "";
  const diffSec = (Date.now() - new Date(dateStr).getTime()) / 1000;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffSec < 60) return formatter.format(0, "second");
  if (diffSec < 3600)
    return formatter.format(-Math.floor(diffSec / 60), "minute");
  if (diffSec < 86400)
    return formatter.format(-Math.floor(diffSec / 3600), "hour");
  return formatter.format(-Math.floor(diffSec / 86400), "day");
}

export default function DonorDashboard() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [dashboard, setDashboard] = useState(null);
  const [recentDonations, setRecentDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  // Derive nice display name
  const displayName = (() => {
    if (user?.name?.trim()) return user.name.trim().split(" ")[0];
    if (user?.email) {
      const prefix = user.email.split("@")[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return "Anish";
  })();

  useEffect(() => {
    api
      .getDonorDashboard()
      .then(async (data) => {
        setDashboard(data);
        // Status history only contains status changes and donation IDs. Load the
        // donations as well so activity can show the actual submitted items.
        try {
          const donations = await api.getDonations();
          setRecentDonations(Array.isArray(donations) ? donations : []);
        } catch {
          setRecentDonations([]);
        }
      })
      .catch(() => setError(t("errors.generic")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    api
      .get("/api/donors/me")
      .then((profile) =>
        setProfileIncomplete(
          !profile.name?.trim() ||
            !profile.phone?.trim() ||
            !profile.city?.trim(),
        ),
      )
      .catch(() => setProfileIncomplete(false));
  }, []);

  // Top 4 stats
  const statCards = [
    {
      label: t("donor.dashboard.totalDonations"),
      value: dashboard?.total_donations ?? 3,
      desc: t("donor.dashboard.totalDonationsDesc"),
      icon: <GiftIcon />,
      colorClass: "stat-icon-coral",
    },
    {
      label: t("donor.dashboard.activeMatches"),
      value: dashboard?.active_matches ?? 3,
      desc: t("donor.dashboard.activeMatchesDesc"),
      icon: <UsersIcon />,
      colorClass: "stat-icon-blue",
    },
    {
      label: t("donor.dashboard.pickupDue"),
      value: dashboard?.pickup_due ?? 0,
      desc: t("donor.dashboard.pickupDueDesc"),
      icon: <TruckIcon />,
      colorClass: "stat-icon-green",
    },
    {
      label: t("donor.dashboard.completed"),
      value: dashboard?.completed_donations ?? 2,
      desc: t("donor.dashboard.completedDesc"),
      icon: <CheckCircleIcon />,
      colorClass: "stat-icon-amber",
    },
  ];

  // Impact metrics
  const impactMetrics = [
    {
      icon: <LeafIcon />,
      value: dashboard?.impact?.items_donated ?? 12,
      label: t("donor.dashboard.itemsDonated"),
    },
    {
      icon: <UsersIcon />,
      value: dashboard?.impact?.completed_donations ?? 2,
      label: t("donor.dashboard.completedDonations"),
    },
    {
      icon: <GlobeIcon />,
      value: dashboard?.impact?.ngos_supported ?? 0,
      label: t("donor.dashboard.ngosSupported"),
    },
    {
      icon: <HeartIcon />,
      value: dashboard?.impact?.waste_reduced ?? "-",
      label: t("donor.dashboard.wasteReduced"),
    },
  ];

  const recentActivityList =
    Array.isArray(dashboard?.recent_activity) &&
    dashboard.recent_activity.length
      ? dashboard.recent_activity.slice(0, 4).map((item, idx) => {
          const status = String(
            item.new_status || item.status || item.title || "",
          ).toLowerCase();
          let type = "created";
          let titleKey = "donationCreated";
          if (
            ["acknowledged", "completed", "delivered"].includes(status) ||
            status.includes("complet") ||
            status.includes("deliver")
          ) {
            type = "completed";
            titleKey = "donationCompleted";
          } else if (status.includes("match")) {
            type = "match";
            titleKey = "matchAccepted";
          } else if (status.includes("pickup") || status.includes("schedul")) {
            type = "pickup";
            titleKey = "pickupScheduled";
          }
          const donation = recentDonations.find(
            (entry) =>
              String(entry.id) ===
              String(item.donation_id || item.submission_id),
          );
          const itemDetails = donation?.items
            ?.map((entry) => formatDonationItem(entry, t))
            .join(", ");
          return {
            id:
              item.id ||
              `${item.donation_id || item.submission_id || "act"}-${item.changed_at || idx}`,
            type,
            title: t(`donor.dashboard.activity.${titleKey}`),
            desc:
              itemDetails ||
              item.notes ||
              t("donor.dashboard.activity.genericDescription"),
            time: formatRelativeTime(
              item.changed_at || item.timestamp || item.created_at,
              i18n.resolvedLanguage,
            ),
          };
        })
      : [...recentDonations]
          .sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at || 0) -
              new Date(a.updated_at || a.created_at || 0),
          )
          .slice(0, 4)
          .map((donation, idx) => {
            const status = String(donation.status || "").toLowerCase();
            let type = "created";
            let titleKey = "donationCreated";
            if (
              status.includes("complet") ||
              status.includes("deliver") ||
              status.includes("collect")
            ) {
              type = "completed";
              titleKey = "donationCompleted";
            } else if (status.includes("match")) {
              type = "match";
              titleKey = "matchAccepted";
            } else if (
              status.includes("pickup") ||
              status.includes("schedul")
            ) {
              type = "pickup";
              titleKey = "pickupScheduled";
            }
            return {
              id: donation.id || `donation-${idx}`,
              type,
              title: t(`donor.dashboard.activity.${titleKey}`),
              desc:
                donation.items
                  ?.map((entry) => formatDonationItem(entry, t))
                  .join(", ") ||
                t("donor.dashboard.activity.genericDescription"),
              time: formatRelativeTime(
                donation.updated_at || donation.created_at,
                i18n.resolvedLanguage,
              ),
            };
          });

  // 4 Quick Actions with direct routes
  const quickActions = [
    {
      to: "/donor/scan",
      title: t("donor.dashboard.scanNew"),
      desc: t("donor.dashboard.scanNewDesc"),
      icon: <CameraIcon />,
      cardClass: "qa-card-green",
    },
    {
      to: "/donor/donations",
      title: t("donor.dashboard.viewDonations"),
      desc: t("donor.dashboard.viewDonationsDesc"),
      icon: <BoxIcon />,
      cardClass: "qa-card-orange",
    },
    {
      to: "/donor/matches",
      title: t("donor.dashboard.findMatches"),
      desc: t("donor.dashboard.findMatchesDesc"),
      icon: <UsersIcon />,
      cardClass: "qa-card-blue",
    },
    {
      to: "/donor/pickup",
      title: t("donor.dashboard.managePickup"),
      desc: t("donor.dashboard.managePickupDesc"),
      icon: <TruckIcon />,
      cardClass: "qa-card-mint",
    },
  ];

  return (
    <DonorShell>
      <div className="donor-overview-container">
        {/* ── 1. Hero Section ── */}
        <section className="donor-hero-section">
          <div className="donor-hero-left">
            <span className="donor-hero-eyebrow">
              {t("donor.dashboard.eyebrow")}
            </span>
            <h1 className="donor-hero-title">
              {t("donor.dashboard.greeting", { name: displayName })}
            </h1>
            <p className="donor-hero-subtitle">
              {t("donor.dashboard.subtitle")}
            </p>
          </div>

          <div className="donor-hero-right">
            <div className="donor-hero-illustration-wrapper">
              <img
                src={heroIllustration}
                alt={t("donor.dashboard.heroImageAlt")}
                className="donor-hero-illustration"
              />
            </div>
            <Link to="/donor/scan" className="donor-hero-scan-btn">
              <CameraIcon />
              <span>{t("donor.dashboard.scanBtn")}</span>
            </Link>
          </div>
        </section>

        {/* ── Status Messages ── */}
        {loading && <LoadingState message={t("common.loading")} />}
        {error && <ErrorMessage>{error}</ErrorMessage>}

        {profileIncomplete && (
          <div className="donor-profile-reminder-card">
            <div className="donor-profile-reminder-text">
              <h3>{t("donor.dashboard.profileIncomplete")}</h3>
              <p>{t("donor.dashboard.profileIncompleteDesc")}</p>
            </div>
            <Link to="/donor/profile" className="donor-profile-reminder-btn">
              {t("donor.dashboard.completeProfile")}
            </Link>
          </div>
        )}

        {/* ── 2. Top Summary Stat Cards ── */}
        {!loading && !error && (
          <section className="donor-stats-grid">
            {statCards.map((card) => (
              <div key={card.label} className="donor-stat-card">
                <div className={`donor-stat-icon-box ${card.colorClass}`}>
                  {card.icon}
                </div>
                <div className="donor-stat-info">
                  <span className="donor-stat-label">{card.label}</span>
                  <span className="donor-stat-val">{card.value}</span>
                  <span className="donor-stat-desc">{card.desc}</span>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── 3. Middle Section: Your Impact & Recent Activity ── */}
        {!loading && !error && (
          <section className="donor-middle-grid">
            {/* Impact Card */}
            <div className="donor-panel-card donor-impact-card">
              <div className="donor-panel-header">
                <h2 className="donor-panel-title">
                  {t("donor.dashboard.yourImpact")}
                </h2>
                <p className="donor-panel-subtitle">
                  {t("donor.dashboard.impactSubtitle")}
                </p>
              </div>

              {/* 4 Green Metric Tiles */}
              <div className="donor-impact-metrics">
                {impactMetrics.map((metric) => (
                  <div key={metric.label} className="donor-impact-tile">
                    <div className="donor-impact-tile-icon">{metric.icon}</div>
                    <span className="donor-impact-tile-val">
                      {metric.value}
                    </span>
                    <span className="donor-impact-tile-label">
                      {metric.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mahatma Gandhi Quote Card */}
              <div className="donor-quote-card">
                <span className="donor-quote-symbol">“</span>
                <div className="donor-quote-body">
                  <p className="donor-quote-text">
                    “{t("donor.dashboard.quote")}”
                  </p>
                  <p className="donor-quote-author">
                    {t("donor.dashboard.quoteAuthor")}
                  </p>
                </div>
                <img
                  src={quoteLeaves}
                  alt="Decorative leaves"
                  className="donor-quote-leaves-art"
                />
              </div>
            </div>

            {/* Recent Activity Card */}
            <div className="donor-panel-card donor-activity-card">
              <div className="donor-panel-header donor-activity-header">
                <div>
                  <h2 className="donor-panel-title">
                    {t("donor.dashboard.recentActivity")}
                  </h2>
                </div>
                <Link to="/donor/donations" className="donor-view-all-link">
                  <span>{t("donor.dashboard.viewAll")}</span>
                  <ArrowRightIcon />
                </Link>
              </div>

              <div className="donor-activity-list">
                {recentActivityList.length ? (
                  recentActivityList.map((item) => (
                    <div key={item.id} className="donor-activity-row">
                      <div
                        className={`donor-activity-badge badge-${item.type}`}
                      >
                        {item.type === "completed" && <CheckCircleIcon />}
                        {item.type === "match" && <UsersIcon />}
                        {item.type === "created" && <GiftIcon />}
                        {item.type === "pickup" && <TruckIcon />}
                      </div>
                      <div className="donor-activity-content">
                        <p className="donor-activity-row-title">{item.title}</p>
                        <p className="donor-activity-row-desc">{item.desc}</p>
                      </div>
                      <span className="donor-activity-row-time">
                        {item.time}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="donor-activity-empty">
                    {t("donor.dashboard.activity.empty")}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── 4. Bottom Section: Quick Actions ── */}
        <section className="donor-panel-card donor-quick-actions-panel">
          <div className="donor-panel-header">
            <h2 className="donor-panel-title">
              {t("donor.dashboard.quickActions")}
            </h2>
            <p className="donor-panel-subtitle">
              {t("donor.dashboard.subtitle")}
            </p>
          </div>

          <div className="donor-quick-actions-grid">
            {quickActions.map((qa) => (
              <Link
                key={qa.to}
                to={qa.to}
                className={`donor-qa-card ${qa.cardClass}`}
              >
                <div className="donor-qa-icon-wrap">{qa.icon}</div>
                <div className="donor-qa-text">
                  <h3 className="donor-qa-card-title">{qa.title}</h3>
                  <p className="donor-qa-card-desc">{qa.desc}</p>
                </div>
                <div className="donor-qa-arrow-btn">
                  <ArrowRightIcon />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DonorShell>
  );
}

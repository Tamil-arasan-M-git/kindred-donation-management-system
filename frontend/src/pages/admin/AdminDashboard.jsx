import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ErrorMessage from "../../components/common/ErrorMessage";
import EmptyState from "../../components/common/EmptyState";
import PageHeader from "../../components/layout/PageHeader";
import api from "../../api/client";
import i18n from "../../i18n";
import AdminShell from "./AdminShell";
import "./AdminDashboard.css";

const formatDate = (value, locale, options = {}) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : new Intl.DateTimeFormat(locale, options).format(date);
};
const formatNumber = (value, locale) => new Intl.NumberFormat(locale).format(Number(value) || 0);

const initials = (value) => String(value || "N/A").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const changeLabel = (value, locale, fromLastMonth) => typeof value === "number" && Number.isFinite(value) ? `${value >= 0 ? "↑" : "↓"} ${formatNumber(Math.abs(value), locale)}% ${fromLastMonth}` : null;
const metricDefinitions = [
  ["total_ngos", "Total NGOs", "fi-rr-users", "green", "ngos"],
  ["total_donors", "Total Donors", "fi-rr-user", "blue", "donors"],
  ["total_donations", "Total Donations", "fi-rr-gift", "purple", "donations"],
  ["total_demands", "Total Demands", "fi-rr-clipboard-list-check", "orange", "demands"],
  ["total_matches", "Total Matches", "fi-rr-link", "teal", "matches"],
];

function SkeletonDashboard({ label }) {
  return <div className="admin-dashboard-skeleton" aria-label={label}><div className="admin-dashboard-skeleton-metrics">{metricDefinitions.map(([key]) => <span key={key} />)}</div><div className="admin-dashboard-skeleton-main"><span /><span /></div><div className="admin-dashboard-skeleton-lists"><span /><span /><span /></div></div>;
}

function GrowthChart({ growth, emptyLabel, t }) {
  const months = Array.isArray(growth?.months) ? growth.months : [];
  const series = [["ngos", t("admin.dashboard.total_ngos", { defaultValue: "NGOs" }), "#218e5c"], ["donors", t("admin.dashboard.total_donors", { defaultValue: "Donors" }), "#2e87d9"], ["donations", t("admin.dashboard.total_donations", { defaultValue: "Donations" }), "#7b5ce4"], ["demands", t("admin.dashboard.total_demands", { defaultValue: "Demands" }), "#ed761e"], ["matches", t("admin.dashboard.total_matches", { defaultValue: "Matches" }), "#159f91"]];
  const max = Math.max(0, ...series.flatMap(([key]) => growth?.[key] || []));
  const hasData = months.length > 0 && max > 0;
  const x = (index) => 34 + (index * 652) / Math.max(months.length - 1, 1);
  const y = (value) => 210 - (Number(value || 0) / Math.max(max, 1)) * 170;
  return <div className="admin-dashboard-chart" aria-label="Platform growth chart"><div className="admin-dashboard-legend">{series.map(([, label, color]) => <span key={label}><i style={{ background: color }} />{label}</span>)}</div>{hasData ? <svg viewBox="0 0 720 250" role="img" aria-labelledby="growth-chart-title"><title id="growth-chart-title">Platform growth over the available six-month period</title><desc>{series.map(([key, label]) => `${label}: ${(growth?.[key] || []).join(", ")}`).join(". ")}</desc>{[0, 1, 2, 3, 4].map((line) => <line key={line} x1="34" x2="686" y1={40 + line * 42.5} y2={40 + line * 42.5} className="admin-dashboard-chart-grid" />)}{series.map(([key, , color]) => { const values = Array.isArray(growth[key]) ? growth[key] : []; const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" "); return <g key={key}><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" />{values.map((value, index) => <circle key={`${key}-${index}`} cx={x(index)} cy={y(value)} r="3.5" fill={color} />)}</g>; })}{months.map((month, index) => <text key={`${month}-${index}`} x={x(index)} y="238" textAnchor="middle" className="admin-dashboard-chart-label">{month}</text>)}</svg> : <p className="admin-dashboard-chart-empty">{emptyLabel}</p>}</div>;
}

function VerificationRing({ title, data }) {
  const percentage = Number.isFinite(Number(data?.percentage)) ? Number(data.percentage) : 0;
  const locale = i18n.resolvedLanguage || "en";
  return <div className="admin-dashboard-verification-item"><div className="admin-dashboard-ring" style={{ "--ring-value": `${Math.max(0, Math.min(100, percentage))}%` }}><strong>{formatNumber(percentage, locale)}%</strong></div><h3>{title}</h3><p><span className="verified-dot" />{formatNumber(data?.verified, locale)} {i18n.t("admin.verified", { defaultValue: "Verified" })}</p><p><span className="unverified-dot" />{formatNumber(data?.unverified, locale)} {i18n.t("admin.unverified", { defaultValue: "Unverified" })}</p></div>;
}

function RecentPerson({ record, locale, type, t }) {
  const name = record.name || record.email || "N/A";
  return <div className="admin-dashboard-person-row"><span className={`admin-dashboard-avatar ${type}`}>{initials(name)}</span><div><strong>{name}</strong><small>{record.city || "N/A"}</small></div><time>{formatDate(record.created_at, locale, { day: "2-digit", month: "short", year: "numeric" })}</time><span className={`admin-dashboard-badge ${record.verified ? "verified" : "unverified"}`}><i />{record.verified ? t("admin.verified", { defaultValue: "Verified" }) : t("admin.unverified", { defaultValue: "Unverified" })}</span></div>;
}

function RecentDonation({ donation, locale, t }) {
  const itemText = (donation.items || []).map((item) => `${item.class_name || item.category || t("admin.dashboard.item", { defaultValue: "Item" })} (${formatNumber(item.quantity, locale)})`).join(", ");
  const routeText = donation.ngo_name ? `${t("admin.dashboard.by", { defaultValue: "By" })} ${donation.donor_name || t("admin.donations.unknownDonor", { defaultValue: "Unknown donor" })} → ${donation.ngo_name}` : `${t("admin.dashboard.by", { defaultValue: "By" })} ${donation.donor_name || t("admin.donations.unknownDonor", { defaultValue: "Unknown donor" })}`;
  const status = donation.status || "unknown";
  return <div className="admin-dashboard-donation-row"><span className="admin-dashboard-donation-icon"><i className="fi fi-rr-box" /></span><div><strong>{itemText || t("admin.dashboard.noItemDetails", { defaultValue: "No item details" })}</strong><small>{routeText}</small></div><time>{formatDate(donation.created_at, locale, { day: "2-digit", month: "short", year: "numeric" })}</time><span className={`admin-dashboard-status status-${String(status).toLowerCase()}`}>{t(`status.${status}`, { defaultValue: donation.status || t("admin.dashboard.unknownStatus", { defaultValue: "Unknown" }) })}</span></div>;
}

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const locale = i18n.resolvedLanguage || undefined;
  const loadDashboard = useCallback(async () => { setLoading(true); setError(""); try { setDashboard(await api.getAdminDashboard()); } catch (err) { setDashboard(null); setError(t("errors.generic")); } finally { setLoading(false); } }, [t]);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  const today = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date()), [locale]);
  const summary = Object.fromEntries(Object.entries(dashboard?.summary || {}).map(([key, value]) => [key, formatNumber(value, locale)]));
  const changes = dashboard?.growth?.changes || {};
  const attention = Object.fromEntries(Object.entries(dashboard?.attention || {}).map(([key, value]) => [key, formatNumber(value, locale)]));
  const empty = t("admin.dashboard.noData", { defaultValue: "No data available yet." });
  return <AdminShell><div className="admin-dashboard-page"><PageHeader eyebrow={t("admin.dashboard.eyebrow", { defaultValue: "Admin Overview" })} title={t("admin.dashboard.title", { defaultValue: "Admin Overview" })} description={t("admin.dashboard.description", { defaultValue: "Platform administration overview and key insights." })} action={<div className="admin-dashboard-date"><i className="fi fi-rr-calendar" /><span>{t("admin.dashboard.today", { defaultValue: "Today" })}<strong>{today}</strong></span><i className="fi fi-rr-angle-small-down" /></div>} />{loading ? <SkeletonDashboard label={t("common.loading")} /> : null}{error ? <ErrorMessage onRetry={loadDashboard}>{t("admin.dashboard.loadError", { defaultValue: "Unable to load admin overview." })}</ErrorMessage> : null}{!loading && !error && dashboard ? <><section className="admin-dashboard-metrics" aria-label={t("admin.dashboard.summary", { defaultValue: "Platform summary" })}>{metricDefinitions.map(([key, label, icon, color, changeKey]) => <article className={`admin-dashboard-metric ${color}`} key={key}><span className="admin-dashboard-metric-icon"><i className={`fi ${icon}`} /></span><div><small>{t(`admin.dashboard.${key}`, { defaultValue: label })}</small><strong>{summary?.[key] ?? 0}</strong><em className={changes[changeKey] < 0 ? "negative" : ""}>{changeLabel(changes[changeKey]) || t("admin.dashboard.noPreviousData", { defaultValue: "No previous-month data" })}</em></div></article>)}</section><section className="admin-dashboard-insight-grid"><article className="admin-dashboard-panel growth-panel"><header><h2><i className="fi fi-rr-chart-line-up" />{t("admin.dashboard.growth", { defaultValue: "Platform Growth (Last 6 Months)" })}</h2><span>{dashboard.growth?.months?.length ? t("admin.dashboard.monthCount", { count: dashboard.growth.months.length, defaultValue: `${dashboard.growth.months.length} months` }) : t("admin.dashboard.noRange", { defaultValue: "No range" })}</span></header><GrowthChart growth={dashboard.growth} t={t} emptyLabel={t("admin.dashboard.noGrowth", { defaultValue: "No historical growth data available yet." })} /></article><article className="admin-dashboard-panel verification-panel"><header><h2><i className="fi fi-rr-shield-check" />{t("admin.dashboard.verification", { defaultValue: "Verification Status" })}</h2></header><div className="admin-dashboard-verification-grid"><VerificationRing title={t("admin.dashboard.ngosVerified", { defaultValue: "NGOs Verified" })} data={dashboard.verification?.ngos} /><VerificationRing title={t("admin.dashboard.donorsVerified", { defaultValue: "Donors Verified" })} data={dashboard.verification?.donors} /></div></article></section><section className="admin-dashboard-recent-grid"><article className="admin-dashboard-panel recent-panel"><header><h2><i className="fi fi-rr-building" />{t("admin.dashboard.recentNgos", { defaultValue: "Recent NGOs" })}</h2><Link to="/admin/ngos">{t("admin.dashboard.viewAll", { defaultValue: "View all" })} <span>→</span></Link></header>{dashboard.recent_ngos?.length ? dashboard.recent_ngos.slice(0, 5).map((record) => <RecentPerson key={record.id} record={record} locale={locale} type="ngo" t={t} />) : <EmptyState title={empty} />}</article><article className="admin-dashboard-panel recent-panel"><header><h2><i className="fi fi-rr-users" />{t("admin.dashboard.recentDonors", { defaultValue: "Recent Donors" })}</h2><Link to="/admin/donors">{t("admin.dashboard.viewAll", { defaultValue: "View all" })} <span>→</span></Link></header>{dashboard.recent_donors?.length ? dashboard.recent_donors.slice(0, 5).map((record) => <RecentPerson key={record.id} record={record} locale={locale} type="donor" t={t} />) : <EmptyState title={empty} />}</article><article className="admin-dashboard-panel recent-panel"><header><h2><i className="fi fi-rr-box" />{t("admin.dashboard.recentDonations", { defaultValue: "Recent Donations" })}</h2><Link to="/admin/donations">{t("admin.dashboard.viewAll", { defaultValue: "View all" })} <span>→</span></Link></header>{dashboard.recent_donations?.length ? dashboard.recent_donations.slice(0, 5).map((record) => <RecentDonation key={record.id} donation={record} locale={locale} t={t} />) : <EmptyState title={empty} />}</article></section><section className="admin-dashboard-panel attention-panel"><header><h2><i className="fi fi-rr-exclamation" />{t("admin.dashboard.attention", { defaultValue: "Needs Attention" })}</h2><span>{t("admin.dashboard.currentItems", { defaultValue: "Current platform items" })}</span></header><div className="admin-dashboard-attention-grid"><Link to="/admin/ngos"><strong>{attention.unverified_ngos ?? 0}</strong><span>{t("admin.dashboard.unverifiedNgos", { defaultValue: "NGOs awaiting verification" })}</span><i>→</i></Link><Link to="/admin/donors"><strong>{attention.unverified_donors ?? 0}</strong><span>{t("admin.dashboard.unverifiedDonors", { defaultValue: "Donors awaiting verification" })}</span><i>→</i></Link><Link to="/admin/demands"><strong>{attention.open_demands ?? 0}</strong><span>{t("admin.dashboard.openDemands", { defaultValue: "Open demands" })}</span><i>→</i></Link><Link to="/admin/matches"><strong>{attention.pending_matches ?? 0}</strong><span>{t("admin.dashboard.pendingMatches", { defaultValue: "Pending matches" })}</span><i>→</i></Link></div></section><section className="admin-dashboard-panel quick-links-panel"><header><h2><i className="fi fi-rr-bolt" />{t("admin.dashboard.quickLinks", { defaultValue: "Quick Management Links" })}</h2></header><div>{[["/admin/ngos", "All NGOs", "fi-rr-building", "ngos"], ["/admin/donors", "All Donors", "fi-rr-users", "donors"], ["/admin/donations", "All Donations", "fi-rr-gift", "donations"], ["/admin/demands", "All Demands", "fi-rr-clipboard-list-check", "demands"], ["/admin/matches", "All Matches", "fi-rr-link", "matches"]].map(([to, label, icon, key]) => <Link to={to} key={to}><i className={`fi ${icon}`} />{t(`admin.dashboard.quick.${key}`, { defaultValue: label })}<span>→</span></Link>)}</div></section></> : null}</div></AdminShell>;
}

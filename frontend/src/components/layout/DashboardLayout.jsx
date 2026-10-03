import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../notifications/NotificationBell";
import KindredLogo from "../common/KindredLogo";
import LanguageSelector from "../common/LanguageSelector";

const roleNavigation = {
  donor: [
    ["Overview", "/donor"],
    ["Scan Items", "/donor/scan"],
    ["Matches", "/donor/matches"],
    ["Donations", "/donor/donations"],
    ["Pickup", "/donor/pickup"],
    ["Profile", "/donor/profile"],
  ],
  ngo: [
    ["Overview", "/ngo"],
    ["Demands", "/ngo/demands"],
    ["Matches", "/ngo/matches"],
    ["Donations", "/ngo/donations"],
    ["Operations", "/ngo/operations"],
    ["Staff", "/ngo/staff"],
    ["Profile", "/ngo/profile"],
  ],
  admin: [
    ["Overview", "/admin"],
    ["NGOs", "/admin/ngos"],
    ["Donors", "/admin/donors"],
    ["Donations", "/admin/donations"],
    ["Demands", "/admin/demands"],
    ["Matches", "/admin/matches"],
  ],
};

const navKeyMap = {
  Overview: "navigation.overview",
  "Scan Items": "navigation.scanItems",
  Matches: "navigation.matches",
  Donations: "navigation.donations",
  Pickup: "navigation.pickup",
  Profile: "navigation.profile",
  Demands: "navigation.demands",
  Operations: "navigation.operations",
  Staff: "navigation.staff",
  NGOs: "navigation.ngos",
  Donors: "navigation.donors",
};

function NavIcon({ label }) {
  const s = { width: 20, height: 20, style: { flexShrink: 0 } };
  const p = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const l = label.toLowerCase();

  if (l === "overview") {
    return (
      <svg {...s} viewBox="0 0 24 24" {...p}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  }
  if (l === "scan items" || l === "scan") {
    return (
      <svg {...s} viewBox="0 0 24 24" {...p}>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    );
  }
  if (l === "matches") {
    return (
      <svg {...s} viewBox="0 0 24 24" {...p}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (l === "donations") {
    return (
      <svg {...s} viewBox="0 0 24 24" {...p}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    );
  }
  if (l === "pickup") {
    return (
      <svg {...s} viewBox="0 0 24 24" {...p}>
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    );
  }
  if (l === "profile") {
    return (
      <svg {...s} viewBox="0 0 24 24" {...p}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  if (l === "demands") {
    return (
      <svg {...s} viewBox="0 0 24 24" {...p}>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    );
  }
  if (l === "operations") {
    return (
      <svg {...s} viewBox="0 0 24 24" {...p}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      </svg>
    );
  }
  if (l === "staff" || l === "ngos" || l === "donors") {
    return (
      <svg {...s} viewBox="0 0 24 24" {...p}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  return (
    <svg {...s} viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function getInitials(user) {
  if (user?.name) {
    const parts = user.name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (user?.email) {
    const local = user.email.split("@")[0];
    return local.slice(0, 2).toUpperCase();
  }
  return "AP";
}

export function DashboardLayout({ role, children }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = getInitials(user);
  const roleHome = { donor: "/donor", ngo: "/ngo", admin: "/admin" };

  return (
    <div className={`shell ${menuOpen ? "menu-open" : ""}`}>
      <button
        type="button"
        className="mobile-backdrop"
        aria-label="Close navigation"
        onClick={() => setMenuOpen(false)}
      />
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar-topline">
          <KindredLogo
            size="sm"
            theme="dark"
            showTagline={true}
            to={roleHome[role]}
            className="sidebar-kindred-logo"
          />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <LanguageSelector theme="dark" />
            <NotificationBell />
          </div>
          <button
            type="button"
            className="mobile-close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className="sidebar-nav">
          {roleNavigation[role].map(([label, to]) => (
            <NavLink
              key={to}
              to={to}
              end={to === `/${role}`}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
            >
              <NavIcon label={label} />
              <span className="sidebar-nav-label">
                {t(navKeyMap[label] || label)}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to={`/${role}/profile`}
            className="sidebar-user-pill"
            onClick={() => setMenuOpen(false)}
          >
            <span className="sidebar-avatar">{initials}</span>
            <div className="sidebar-user-details">
              <span className="sidebar-user-email">
                {user?.email || "user1@gmail.com"}
              </span>
            </div>
            <svg
              className="sidebar-chevron"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </NavLink>
          <button
            type="button"
            className="sidebar-logout-button"
            onClick={logout}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>{t("navigation.logout")}</span>
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="mobile-header">
          <button
            type="button"
            className="menu-button"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <span className="mobile-brand">KINDRED</span>
          <span className="mobile-role">{role}</span>
        </header>
        <main className="content-panel">{children}</main>
      </div>
    </div>
  );
}

export function DashboardSummary({ items: suppliedItems } = {}) {
  const items = suppliedItems || [
    { label: "Donations", value: "12" },
    { label: "Open matches", value: "4" },
    { label: "Pickup due", value: "2" },
  ];

  return (
    <div className="stats-grid">
      {items.map((item) => (
        <div key={item.label} className="stat-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

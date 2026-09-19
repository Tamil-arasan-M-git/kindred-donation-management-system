import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../notifications/NotificationBell";

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

export function DashboardLayout({ role, children }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
          <div className="brand">KINDRED</div>
          <NotificationBell />
          <button
            type="button"
            className="mobile-close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            ×
          </button>
        </div>
        <nav>
          {roleNavigation[role].map(([label, to]) => (
            <NavLink
              key={to}
              to={to}
              end={to === `/${role}`}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">{user?.email}</div>
          <button type="button" className="ghost-button" onClick={logout}>
            Log out
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

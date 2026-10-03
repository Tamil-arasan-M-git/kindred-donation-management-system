import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import KindredLogo from "../common/KindredLogo";
import LanguageSelector from "../common/LanguageSelector";
import { useAuth } from "../../context/AuthContext";

export default function HomeNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const { t } = useTranslation();

  const roleHome = { donor: "/donor", ngo: "/ngo", admin: "/admin" };
  const userDashboard = user ? roleHome[user.role] || "/login" : null;

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="home-navbar-header">
      <div className="home-navbar-container">
        <KindredLogo size="md" />

        <nav className="home-nav-links desktop-only" aria-label="Main Navigation">
          <a href="#how-it-works" className="home-nav-link">
            {t("navigation.howItWorks")}
          </a>
          <a href="#for-donors" className="home-nav-link">
            {t("navigation.forDonors")}
          </a>
          <a href="#for-ngos" className="home-nav-link">
            {t("navigation.forNgos")}
          </a>
          <a href="#about" className="home-nav-link">
            {t("navigation.about")}
          </a>
        </nav>

        <div className="home-nav-actions desktop-only">
          {/* Existing globe icon → now a real language selector */}
          <LanguageSelector theme="light" />

          {user && userDashboard ? (
            <Link to={userDashboard} className="home-nav-btn home-nav-btn-primary">
              {t("navigation.dashboard")}
            </Link>
          ) : (
            <>
              <Link to="/login" className="home-nav-btn home-nav-btn-outline">
                {t("navigation.login")}
              </Link>
              <Link to="/register" className="home-nav-btn home-nav-btn-primary">
                {t("navigation.register")}
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="home-mobile-toggle mobile-only"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? (
            <span className="home-close-icon">✕</span>
          ) : (
            <span className="home-hamburger-icon">☰</span>
          )}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="home-mobile-menu mobile-only">
          <nav className="home-mobile-links" aria-label="Mobile Navigation">
            <a href="#how-it-works" className="home-mobile-link" onClick={closeMenu}>
              {t("navigation.howItWorks")}
            </a>
            <a href="#for-donors" className="home-mobile-link" onClick={closeMenu}>
              {t("navigation.forDonors")}
            </a>
            <a href="#for-ngos" className="home-mobile-link" onClick={closeMenu}>
              {t("navigation.forNgos")}
            </a>
            <a href="#about" className="home-mobile-link" onClick={closeMenu}>
              {t("navigation.about")}
            </a>
          </nav>
          <div className="home-mobile-actions">
            <LanguageSelector theme="light" />
            {user && userDashboard ? (
              <Link
                to={userDashboard}
                className="home-nav-btn home-nav-btn-primary"
                onClick={closeMenu}
              >
                {t("navigation.dashboard")}
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="home-nav-btn home-nav-btn-outline"
                  onClick={closeMenu}
                >
                  {t("navigation.login")}
                </Link>
                <Link
                  to="/register"
                  className="home-nav-btn home-nav-btn-primary"
                  onClick={closeMenu}
                >
                  {t("navigation.register")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

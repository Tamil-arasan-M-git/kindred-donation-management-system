import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import heroImg from "../../assets/hero-kindred.png";

export default function HeroSection() {
  const { t } = useTranslation();
  return (
    <section className="home-hero-section">
      <div className="home-leaf-bg home-leaf-top-left" aria-hidden="true" />
      <div className="home-leaf-bg home-leaf-bottom-right" aria-hidden="true" />

      <div className="home-hero-container">
        <div className="home-hero-content">
          <h1 className="home-hero-title">
            {t("home.hero.title")}
            <span className="home-hero-title-highlight">{t("home.hero.titleHighlight")}</span>
          </h1>

          <p className="home-hero-description">{t("home.hero.description")}</p>

          <div className="home-hero-actions">
            <Link to="/register" className="home-hero-btn home-hero-btn-primary">
              {t("home.hero.ctaPrimary")}
            </Link>
            <a href="#how-it-works" className="home-hero-btn home-hero-btn-secondary">
              {t("home.hero.ctaSecondary")}
            </a>
          </div>

          <div className="home-hero-trust-row">
            <div className="home-trust-item">
              <div className="home-trust-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#163f2d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <rect x="9" y="9" width="6" height="6" />
                  <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
                  <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
                  <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
                  <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
                </svg>
              </div>
              <div className="home-trust-text">
                <strong>{t("home.hero.trustAiTitle")}</strong>
                <span>{t("home.hero.trustAiDesc")}</span>
              </div>
            </div>

            <div className="home-trust-item">
              <div className="home-trust-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#163f2d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <div className="home-trust-text">
                <strong>{t("home.hero.trustTransparentTitle")}</strong>
                <span>{t("home.hero.trustTransparentDesc")}</span>
              </div>
            </div>

            <div className="home-trust-item">
              <div className="home-trust-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#163f2d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="home-trust-text">
                <strong>{t("home.hero.trustCommunityTitle")}</strong>
                <span>{t("home.hero.trustCommunityDesc")}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="home-hero-visual-wrapper">
          <div className="home-hero-visual-card">
            <img
              src={heroImg}
              alt="Kindred donation box packed with clothing, books, and laptop, connected to NGOs"
              className="home-hero-img"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

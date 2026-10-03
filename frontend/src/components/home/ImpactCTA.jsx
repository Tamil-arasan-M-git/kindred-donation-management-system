import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function ImpactCTA() {
  const { t } = useTranslation();
  return (
    <section className="home-impact-section">
      <div className="home-impact-container">
        <div className="home-impact-leaves" aria-hidden="true">
          <svg width="120" height="120" viewBox="0 0 100 100" fill="none" className="home-impact-leaf-svg">
            <path d="M10 90C10 50 40 20 90 20C90 60 60 90 10 90Z" fill="rgba(255, 255, 255, 0.08)" />
            <path d="M10 90L90 20" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="2" />
            <path d="M30 70C30 40 50 30 80 30" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="home-impact-content">
          <h2 className="home-impact-title">{t("home.impact.title")}</h2>
          <p className="home-impact-subtitle">{t("home.impact.subtitle")}</p>
        </div>

        <div className="home-impact-action">
          <Link to="/register" className="home-impact-btn">
            {t("home.impact.cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}

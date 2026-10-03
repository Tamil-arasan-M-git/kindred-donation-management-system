import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import KindredLogo from "../common/KindredLogo";
import kindnessImg from "../../assets/kindness-connects.png";

export default function HomeFooter() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="home-footer" id="about">
      <div className="home-footer-container">
        <div className="home-footer-grid">
          <div className="home-footer-brand-col">
            <KindredLogo size="md" />
            <p className="home-footer-desc">{t("home.footer.description")}</p>
            <div className="home-footer-socials" aria-label="Social media links">
              <span className="home-social-icon" title="Instagram" aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </span>
              <span className="home-social-icon" title="Facebook" aria-label="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </span>
              <span className="home-social-icon" title="LinkedIn" aria-label="LinkedIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </span>
              <span className="home-social-icon" title="YouTube" aria-label="YouTube">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                  <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" />
                </svg>
              </span>
            </div>
          </div>

          <div className="home-footer-nav-col">
            <h4 className="home-footer-col-title">{t("home.footer.forDonors")}</h4>
            <ul className="home-footer-links">
              <li><a href="#how-it-works">{t("navigation.howItWorks")}</a></li>
              <li><Link to="/register">{t("home.footer.startDonating")}</Link></li>
              <li><Link to="/login">{t("home.footer.trackDonations")}</Link></li>
              <li><a href="#how-it-works">{t("home.footer.faqs")}</a></li>
            </ul>
          </div>

          <div className="home-footer-nav-col">
            <h4 className="home-footer-col-title">{t("home.footer.forNgos")}</h4>
            <ul className="home-footer-links">
              <li><Link to="/register">{t("home.footer.joinNgo")}</Link></li>
              <li><Link to="/login">{t("home.footer.manageDonations")}</Link></li>
              <li><a href="#for-donors">{t("home.footer.resources")}</a></li>
              <li><a href="#how-it-works">{t("home.footer.faqs")}</a></li>
            </ul>
          </div>

          <div className="home-footer-nav-col">
            <h4 className="home-footer-col-title">{t("navigation.about")}</h4>
            <ul className="home-footer-links">
              <li><a href="#about">{t("home.footer.ourMission")}</a></li>
              <li><a href="#about">{t("home.footer.ourStory")}</a></li>
              <li><a href="#for-donors">{t("home.footer.impact")}</a></li>
              <li><a href="#about">{t("home.footer.contact")}</a></li>
            </ul>
          </div>

          <div className="home-footer-script-col">
            <img src={kindnessImg} alt="Kindness connects us all. ♡" className="home-footer-script-img" />
          </div>
        </div>

        <div className="home-footer-bottom">
          <p className="home-footer-copyright">
            © {currentYear} Kindred. {t("home.footer.allRightsReserved")}
          </p>
          <div className="home-footer-legal-links">
            <a href="#about">{t("home.footer.privacy")}</a>
            <a href="#about">{t("home.footer.terms")}</a>
            <a href="#about">{t("home.footer.contact")}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

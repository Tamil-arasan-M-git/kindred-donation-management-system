import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import step1Img from "../../assets/step1-capture.png";
import shirtThumb from "../../assets/shirt-thumb.png";
import step3Img from "../../assets/step3-match.png";
import KindredLogo from "../common/KindredLogo";

export default function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section className="home-how-section" id="how-it-works">
      {/* Decorative background leaf */}
      <div className="home-leaf-bg home-leaf-how-right" aria-hidden="true" />

      <div className="home-how-header">
        <span className="home-eyebrow">{t("home.howItWorks.eyebrow")}</span>
        <h2 className="home-how-title">{t("home.howItWorks.title")}</h2>
      </div>

      <div className="home-how-content-grid">
        {/* Left Side: 3 Steps */}
        <div className="home-steps-container">
          {/* STEP 01 */}
          <div className="home-step-item">
            <div className="home-step-visual-card">
              <span className="home-step-number home-step-badge-green">01</span>
              <img
                src={step1Img}
                alt="Smartphone capturing clothing donation"
                className="home-step-img"
              />
            </div>
            <h3 className="home-step-title">{t("home.howItWorks.step1Title")}</h3>
            <p className="home-step-desc">
              {t("home.howItWorks.step1Desc")}
            </p>
          </div>

          {/* Connector Arrow 1 */}
          <div className="home-step-arrow" aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8a9e90"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>

          {/* STEP 02 */}
          <div className="home-step-item">
            <div className="home-step-visual-card home-step-ai-card">
              <span className="home-step-number home-step-badge-coral">02</span>
              <div className="home-ai-result-panel">
                <span className="home-ai-result-label">{t("home.howItWorks.detectedItems")}</span>
                <div className="home-ai-result-row">
                  <img
                    src={shirtThumb}
                    alt="Detected shirt"
                    className="home-ai-thumb"
                  />
                  <div className="home-ai-info">
                    <strong className="home-ai-name">Clothing / Shirt</strong>
                    <span className="home-ai-qty">Quantity: 2</span>
                  </div>
                  <button
                    type="button"
                    className="home-ai-edit-btn"
                    tabIndex="-1"
                    aria-hidden="true"
                  >
                    {t("common.edit")}
                  </button>
                </div>
              </div>
            </div>
            <h3 className="home-step-title">{t("home.howItWorks.step2Title")}</h3>
            <p className="home-step-desc">
              {t("home.howItWorks.step2Desc")}
            </p>
          </div>

          {/* Connector Arrow 2 */}
          <div className="home-step-arrow" aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8a9e90"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>

          {/* STEP 03 */}
          <div className="home-step-item">
            <div className="home-step-visual-card home-step-match-card">
              <span className="home-step-number home-step-badge-green">03</span>
              <img
                src={step3Img}
                alt="Donation box matched with NGO"
                className="home-step-img home-step-match-img"
              />
            </div>
            <h3 className="home-step-title">{t("home.howItWorks.step3Title")}</h3>
            <p className="home-step-desc">
              {t("home.howItWorks.step3Desc")}
            </p>
          </div>
        </div>

        {/* Right Side: Phone / Future PWA Visual Mockup */}
        <div className="home-phone-mockup-wrapper">
          <div className="home-phone-frame">
            {/* Phone Speaker & Camera Notch */}
            <div className="home-phone-top-bar">
              <span className="home-phone-time">9:41</span>
              <div className="home-phone-notch" />
              <div className="home-phone-status-icons">
                <svg width="14" height="10" viewBox="0 0 16 12" fill="#1d2b1d">
                  <path d="M1 9.5a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5v1.5H1V9.5zm5-3a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 10 6.5v4.5H6V6.5zm5-4A1.5 1.5 0 0 1 12.5 1h1A1.5 1.5 0 0 1 15 2.5V11h-4V2.5z" />
                </svg>
              </div>
            </div>

            {/* Inner App Screen */}
            <div className="home-phone-screen">
              <div className="home-phone-brand">
                <KindredLogo size="sm" showTagline={true} to="" />
              </div>

              <div className="home-phone-hero">
                <h4 className="home-phone-title">
                  {t("home.howItWorks.smallDonations")}
                  <br />
                  {t("home.howItWorks.bigChange")}
                </h4>
              </div>

              <div className="home-phone-list">
                <div className="home-phone-item">
                  <div className="home-phone-item-icon home-phone-icon-peach">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#d9774b"
                      strokeWidth="2"
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                  <span>{t("home.howItWorks.scanWithAi")}</span>
                </div>

                <div className="home-phone-item">
                  <div className="home-phone-item-icon home-phone-icon-coral">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#e76f51"
                      strokeWidth="2"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <span>{t("home.howItWorks.matchWithNgos")}</span>
                </div>

                <div className="home-phone-item">
                  <div className="home-phone-item-icon home-phone-icon-mint">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#2e7d57"
                      strokeWidth="2"
                    >
                      <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2L2 7h20L12 2z" />
                    </svg>
                  </div>
                  <span>{t("home.howItWorks.trackImpact")}</span>
                </div>
              </div>

              <Link
                to="/register"
                className="home-phone-cta-btn"
              >
                {t("home.howItWorks.getStarted")}
              </Link>

              {/* Bottom Tab Bar */}
              <div className="home-phone-tab-bar">
                <div className="home-phone-tab active">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                  </svg>
                  <span>{t("home.howItWorks.home")}</span>
                </div>
                <div className="home-phone-tab">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span>{t("home.howItWorks.donate")}</span>
                </div>
                <div className="home-phone-tab">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span>{t("navigation.matches")}</span>
                </div>
                <div className="home-phone-tab">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>{t("navigation.profile")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

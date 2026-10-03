import { useTranslation } from "react-i18next";

export default function FeatureCards() {
  const { t } = useTranslation();

  const features = [
    {
      id: "ai-detection",
      title: t("home.features.aiTitle"),
      description: t("home.features.aiDesc"),
      themeClass: "home-feature-mint",
      iconBg: "#357a58",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      ),
    },
    {
      id: "ngo-matching",
      title: t("home.features.matchingTitle"),
      description: t("home.features.matchingDesc"),
      themeClass: "home-feature-peach",
      iconBg: "#e76f51",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: "track-step",
      title: t("home.features.trackTitle"),
      description: t("home.features.trackDesc"),
      themeClass: "home-feature-blue",
      iconBg: "#457b9d",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
  ];

  return (
    <section className="home-features-section" id="for-donors">
      <div className="home-features-container">
        {features.map((feature) => (
          <div key={feature.id} className={`home-feature-card ${feature.themeClass}`}>
            <div className="home-feature-icon-wrapper" style={{ backgroundColor: feature.iconBg }}>
              {feature.icon}
            </div>
            <div className="home-feature-body">
              <h3 className="home-feature-title">{feature.title}</h3>
              <p className="home-feature-desc">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

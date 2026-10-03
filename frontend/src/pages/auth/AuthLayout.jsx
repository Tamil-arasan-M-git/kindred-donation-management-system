import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import KindredLogo from "../../components/common/KindredLogo";

export default function AuthLayout({
  title,
  description,
  children,
  footerLink,
  footerText,
  footerLinkLabel,
  variant = "default",
}) {
  const { t } = useTranslation();
  const splitVariant = variant !== "default";
  const authNamespace = variant === "login" ? "login" : "register";
  return (
    <div className={`auth-shell${splitVariant ? " auth-login-shell" : ""}`}>
      {splitVariant ? (
        <section className="auth-login-brand" aria-label={t(`auth.${authNamespace}.brandLabel`, { defaultValue: "Kindred welcome" })}>
          <KindredLogo size="lg" theme="dark" to="" className="auth-login-logo" />
          <div className="auth-login-brand-copy">
            <span className="auth-login-eyebrow">{t(`auth.${authNamespace}.brandEyebrow`, { defaultValue: "Welcome to Kindred" })}</span>
            <h1><span>{t(`auth.${authNamespace}.brandTitleLead`, { defaultValue: "Kindness creates real" })}</span> <em>{t(`auth.${authNamespace}.brandTitleAccent`, { defaultValue: "change." })}</em></h1>
            <p>{t(`auth.${authNamespace}.brandDescription`, { defaultValue: "A trusted platform connecting generous donors with verified NGOs to ensure resources reach the people who need them most." })}</p>
            <div className="auth-login-features">
              {[["fi-rr-heart", "featureMeaningfulTitle", "featureMeaningfulDescription"], ["fi-rr-leaf", "featureVerifiedTitle", "featureVerifiedDescription"], ["fi-rr-users", "featureCommunityTitle", "featureCommunityDescription"]].map(([icon, titleKey, descriptionKey]) => (
                <div className="auth-login-feature" key={titleKey}><span><i className={`fi ${icon}`} aria-hidden="true" /></span><div><strong>{t(`auth.login.${titleKey}`)}</strong><small>{t(`auth.login.${descriptionKey}`)}</small></div></div>
              ))}
            </div>
          </div>
          <span className="auth-login-signature">{t(`auth.${authNamespace}.signature`, { defaultValue: "A kinder tomorrow, together" })}</span>
        </section>
      ) : null}
      <div className={`auth-panel${splitVariant ? " auth-login-panel" : ""}${variant === "register" ? " auth-register-panel" : ""}`}>
        {variant === "default" ? (
        <div className="brand-block">
          <p className="eyebrow">KINDRED</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        ) : (
          <div className="auth-login-heading"><span className="auth-login-card-eyebrow">KINDRED</span><h2>{title}</h2><p>{description}</p></div>
        )}
        {children}
        {footerLink ? (
          <p className="auth-footer">
            {footerText}{" "}
            <Link to={footerLink}>
              {footerLinkLabel || (footerLink === "/login" ? t("navigation.login") : t("auth.login.register", { defaultValue: "Register" }))}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

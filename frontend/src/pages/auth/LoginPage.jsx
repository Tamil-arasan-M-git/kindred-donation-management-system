import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "./AuthLayout";

const roleHome = { donor: "/donor", ngo: "/ngo", admin: "/admin" };
const getDestination = (user) =>
  user ? roleHome[user.role] || "/login" : "/login";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to={getDestination(user)} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      navigate(getDestination(loggedInUser), { replace: true });
    } catch (err) {
      setError(t("auth.login.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.login.title")}
      description={t("auth.login.description")}
      footerLink="/register"
      footerText={t("auth.login.noAccount")}
      footerLinkLabel={t("auth.login.register", { defaultValue: "Register" })}
      variant="login"
    >
      <form onSubmit={handleSubmit} className="auth-form auth-login-form">
        <label className="auth-login-field">
          {t("auth.login.email")}
          <span className="auth-login-input-wrap"><i className="fi fi-rr-envelope" aria-hidden="true" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.login.emailPlaceholder", { defaultValue: "Enter your email" })} autoComplete="email" required /></span>
        </label>
        <label className="auth-login-field">
          {t("auth.login.password")}
          <span className="auth-login-input-wrap"><i className="fi fi-rr-lock" aria-hidden="true" /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.login.passwordPlaceholder", { defaultValue: "Enter your password" })} autoComplete="current-password" required /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? t("auth.login.hidePassword", { defaultValue: "Hide password" }) : t("auth.login.showPassword", { defaultValue: "Show password" })}><i className={`fi ${showPassword ? "fi-rr-eye-crossed" : "fi-rr-eye"}`} aria-hidden="true" /></button></span>
        </label>
        {error ? <div className="error-box" role="alert">{error}</div> : null}
        <button type="submit" className="auth-login-submit" disabled={loading}>
          <i className={`fi ${loading ? "fi-rr-spinner" : "fi-rr-sign-in-alt"}`} aria-hidden="true" />
          {loading ? t("auth.login.signingIn") : t("auth.login.signIn")}
        </button>
      </form>
    </AuthLayout>
  );
}

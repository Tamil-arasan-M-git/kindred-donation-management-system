import { Link } from "react-router-dom";

export default function AuthLayout({
  title,
  description,
  children,
  footerLink,
  footerText,
}) {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="brand-block">
          <p className="eyebrow">KINDRED</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
        {footerLink ? (
          <p className="auth-footer">
            {footerText}{" "}
            <Link to={footerLink}>
              {footerLink === "/login" ? "Sign in" : "Log in"}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

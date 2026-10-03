import { Link } from "react-router-dom";

export default function KindredLogo({
  size = "md",
  showTagline = true,
  theme = "light",
  to = "/",
  className = "",
}) {
  const iconSizes = {
    sm: { width: 28, height: 28 },
    md: { width: 36, height: 36 },
    lg: { width: 44, height: 44 },
  };

  const currentSize = iconSizes[size] || iconSizes.md;
  const isDark = theme === "dark";

  const content = (
    <div
      className={`kindred-logo-wrapper kindred-logo-${size} ${
        isDark ? "kindred-logo-dark" : ""
      } ${className}`}
    >
      <svg
        width={currentSize.width}
        height={currentSize.height}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="kindred-logo-icon"
        aria-hidden="true"
      >
        {/* Left caring figure (coral) */}
        <circle cx="13" cy="11.5" r="3.2" fill="#d9774b" />
        <path
          d="M7 16.5C5.8 19 6.2 22.8 9.5 26.5L18 33C14.5 29 11.5 25.5 11 22C10.5 18.5 12.5 16 15 15.5"
          fill="#d9774b"
        />
        <path
          d="M13 14.5C10 14.5 7.5 16.8 7 19.5C6.5 22.2 8.5 25.5 11.5 28.5L18 33C13 28 8.5 24 8 20C7.5 16 10 13.5 13 14.5Z"
          fill="#d9774b"
        />

        {/* Right caring figure (deep green for light mode, vibrant mint for dark mode) */}
        <circle cx="23" cy="11.5" r="3.2" fill={isDark ? "#4caf82" : "#163f2d"} />
        <path
          d="M23 14.5C26 14.5 28.5 16.8 29 19.5C29.5 22.2 27.5 25.5 24.5 28.5L18 33C23 28 27.5 24 28 20C28.5 16 26 13.5 23 14.5Z"
          fill={isDark ? "#4caf82" : "#163f2d"}
        />
        {/* Soft center heart accent */}
        <path
          d="M18 20C17 18.5 15 17.5 13.5 18.5C12 19.5 12.2 21.5 14 23.5L18 27.5L22 23.5C23.8 21.5 24 19.5 22.5 18.5C21 17.5 19 18.5 18 20Z"
          fill="#e76f51"
          opacity="0.85"
        />
      </svg>
      <div className="kindred-logo-text">
        <span className="kindred-brand-name">Kindred</span>
        {showTagline && (
          <span className="kindred-brand-tagline">
            A kinder tomorrow, together
          </span>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="kindred-logo-link" aria-label="Kindred Home">
        {content}
      </Link>
    );
  }

  return content;
}

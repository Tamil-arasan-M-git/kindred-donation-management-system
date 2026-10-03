import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../../i18n/language";
import "./LanguageSelector.css";

export default function LanguageSelector({ theme = "light" }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ||
    SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
    }
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function selectLanguage(code) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  return (
    <div
      className={`lang-selector-wrapper lang-selector-${theme}`}
      ref={wrapperRef}
    >
      <button
        type="button"
        className="lang-selector-trigger"
        aria-label={t("accessibility.changeLanguage", { defaultValue: "Change language" })}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{currentLang.nativeName}</span>
        <svg
          className={`lang-chevron-icon${open ? " chevron-open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="lang-dropdown-menu"
          role="listbox"
          aria-label={t("accessibility.changeLanguage", { defaultValue: "Change language" })}
        >
          <div className="lang-dropdown-list">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={lang.code === i18n.language}
                className={`lang-option-btn${lang.code === i18n.language ? " active" : ""}`}
                onClick={() => selectLanguage(lang.code)}
              >
                <span className="lang-native-name">{lang.nativeName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

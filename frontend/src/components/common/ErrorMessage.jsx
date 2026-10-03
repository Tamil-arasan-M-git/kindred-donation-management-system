import { useTranslation } from "react-i18next";

export default function ErrorMessage({ children, onRetry = null }) {
  const { t } = useTranslation();
  return (
    <div className="state-panel error-message" role="alert">
      <strong>{t("errors.attention")}</strong>
      <p>{children}</p>
      {onRetry ? (
        <button
          type="button"
          className="ui-button ui-button-secondary"
          onClick={onRetry}
        >
          {t("errors.retry")}
        </button>
      ) : null}
    </div>
  );
}

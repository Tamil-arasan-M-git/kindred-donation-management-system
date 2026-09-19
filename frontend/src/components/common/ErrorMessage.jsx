export default function ErrorMessage({ children, onRetry = null }) {
  return (
    <div className="state-panel error-message" role="alert">
      <strong>Something needs attention</strong>
      <p>{children}</p>
      {onRetry ? (
        <button
          type="button"
          className="ui-button ui-button-secondary"
          onClick={onRetry}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

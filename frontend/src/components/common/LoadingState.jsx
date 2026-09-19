export default function LoadingState({ message = "Loading..." }) {
  return (
    <div className="state-panel loading-state" role="status">
      <span className="loading-dot" />
      {message}
    </div>
  );
}

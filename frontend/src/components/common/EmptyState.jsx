export default function EmptyState({ title, children, action = null }) {
  return (
    <div className="state-panel empty-state">
      <div className="state-mark">○</div>
      <div>
        <h2>{title}</h2>
        {children ? <p>{children}</p> : null}
        {action ? <div className="state-action">{action}</div> : null}
      </div>
    </div>
  );
}

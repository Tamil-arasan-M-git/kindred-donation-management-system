export default function PageHeader({
  eyebrow,
  title,
  description,
  action = null,
  actionClassName = "",
}) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {action ? (
        <div className={`page-action ${actionClassName}`.trim()}>{action}</div>
      ) : null}
    </div>
  );
}

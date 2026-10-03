import "./Skeleton.css";

export function Skeleton({ className = "", ...props }) {
  return <span className={`skeleton ${className}`.trim()} aria-hidden="true" {...props} />;
}

export function SkeletonText({ lines = 2, className = "" }) {
  return (
    <span className={`skeleton-text ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={index === lines - 1 ? "short" : ""} />
      ))}
    </span>
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`skeleton-card ${className}`.trim()} aria-hidden="true">
      <Skeleton className="skeleton-card-icon" />
      <div className="skeleton-card-copy">
        <Skeleton className="skeleton-line medium" />
        <Skeleton className="skeleton-line large" />
        <Skeleton className="skeleton-line small" />
      </div>
    </div>
  );
}

export function SkeletonPage({ cards = 4, rows = 3 }) {
  return (
    <div className="skeleton-page" aria-hidden="true">
      <div className="skeleton-page-heading">
        <Skeleton className="skeleton-line eyebrow" />
        <Skeleton className="skeleton-line title" />
        <Skeleton className="skeleton-line subtitle" />
      </div>
      <div className="skeleton-page-cards">
        {Array.from({ length: cards }, (_, index) => <SkeletonCard key={index} />)}
      </div>
      <div className="skeleton-page-content">
        {Array.from({ length: rows }, (_, index) => (
          <div className="skeleton-row" key={index}>
            <Skeleton className="skeleton-row-avatar" />
            <SkeletonText lines={2} />
            <Skeleton className="skeleton-row-action" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonToolbar() {
  return <div className="skeleton-toolbar"><Skeleton className="skeleton-toolbar-search" /><Skeleton className="skeleton-toolbar-filter" /><Skeleton className="skeleton-toolbar-filter" /></div>;
}

function SkeletonTable({ rows = 5 }) {
  return <div className="skeleton-table"><Skeleton className="skeleton-table-head" />{Array.from({ length: rows }, (_, index) => <div className="skeleton-table-row" key={index}><Skeleton className="skeleton-table-avatar" /><SkeletonText lines={2} /><Skeleton className="skeleton-table-cell" /><Skeleton className="skeleton-table-cell short" /><Skeleton className="skeleton-table-action" /></div>)}</div>;
}

function SkeletonList({ rows = 4 }) {
  return <div className="skeleton-list">{Array.from({ length: rows }, (_, index) => <div className="skeleton-list-card" key={index}><Skeleton className="skeleton-list-image" /><SkeletonText lines={3} /><Skeleton className="skeleton-list-action" /></div>)}</div>;
}

export function SkeletonLayout({ variant = "dashboard" }) {
  if (["admin-table", "table", "operations", "staff"].includes(variant)) {
    return <div className={`skeleton-page skeleton-layout-${variant}`}><div className="skeleton-page-heading"><Skeleton className="skeleton-line eyebrow" /><Skeleton className="skeleton-line title" /><Skeleton className="skeleton-line subtitle" /></div><div className="skeleton-page-cards"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div><SkeletonToolbar /><SkeletonTable /></div>;
  }
  if (["cards", "donations", "matches", "pickup"].includes(variant)) {
    return <div className={`skeleton-page skeleton-layout-${variant}`}><div className="skeleton-page-heading"><Skeleton className="skeleton-line eyebrow" /><Skeleton className="skeleton-line title" /><Skeleton className="skeleton-line subtitle" /></div><SkeletonToolbar /><SkeletonList /></div>;
  }
  if (["profile", "form"].includes(variant)) {
    return <div className={`skeleton-page skeleton-layout-${variant}`}><div className="skeleton-page-heading"><Skeleton className="skeleton-line eyebrow" /><Skeleton className="skeleton-line title" /><Skeleton className="skeleton-line subtitle" /></div><div className="skeleton-form-card"><Skeleton className="skeleton-form-banner" /><div className="skeleton-form-grid">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-form-field" key={index}><Skeleton className="skeleton-line small" /><Skeleton className="skeleton-form-input" /></div>)}</div><Skeleton className="skeleton-form-button" /></div></div>;
  }
  if (["detail", "drawer"].includes(variant)) {
    return <div className={`skeleton-page skeleton-layout-${variant}`}><div className="skeleton-detail-hero"><Skeleton className="skeleton-detail-icon" /><div><Skeleton className="skeleton-line medium" /><Skeleton className="skeleton-line large" /></div></div><div className="skeleton-detail-tabs"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div><div className="skeleton-detail-grid"><SkeletonCard /><SkeletonCard /></div><div className="skeleton-detail-panel"><Skeleton className="skeleton-line medium" /><SkeletonText lines={4} /></div><div className="skeleton-detail-panel"><Skeleton className="skeleton-line medium" /><SkeletonText lines={5} /></div></div>;
  }
  if (variant === "checklist") {
    return <div className="skeleton-checklist"><Skeleton className="skeleton-line medium" />{Array.from({ length: 5 }, (_, index) => <div key={index}><Skeleton className="skeleton-check" /><SkeletonText lines={1} /></div>)}</div>;
  }
  return <SkeletonPage />;
}

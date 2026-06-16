// Skeleton placeholder shown while fixtures load — matches the .match-card layout
// so users see the structure they'll get rather than a blank spinner page.
export default function MatchListSkeleton() {
  return (
    <div className="match-skeleton-list" aria-hidden="true">
      <div className="match-skeleton-header" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="match-skeleton-card">
          <div className="match-skeleton-stage" />
          <div className="match-skeleton-body">
            <div className="match-skeleton-team">
              <div className="match-skeleton-flag" />
              <div className="match-skeleton-name" />
            </div>
            <div className="match-skeleton-score" />
            <div className="match-skeleton-team">
              <div className="match-skeleton-name" />
              <div className="match-skeleton-flag" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

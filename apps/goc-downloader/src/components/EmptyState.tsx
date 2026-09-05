import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <div className="row" style={{ justifyContent: "center", marginTop: "1rem" }}>
          {action}
        </div>
      ) : null}
    </div>
  );
}

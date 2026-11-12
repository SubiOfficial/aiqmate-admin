import type { ReactNode } from "react";
import "./SummaryCard.css";

export type CardAccent = "primary" | "success" | "warning" | "danger" | "info" | "secondary";

interface Props {
  icon?: ReactNode;
  iconColor?: CardAccent;
  label: string;
  value: string | number;
  hint?: string;
  onClick?: () => void;
  accent?: CardAccent;
  className?: string;
}

export function SummaryCard({ icon, iconColor = "primary", label, value, hint, onClick, accent, className }: Props) {
  const clickable = !!onClick;
  return (
    <div
      className={`summary-card ${accent ? `summary-card--accent-${accent}` : ""} ${clickable ? "summary-card--clickable" : ""} ${className ?? ""}`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); } : undefined}
    >
      <div className="summary-card__body">
        <span className="summary-card__label">{label}</span>
        <span className="summary-card__value">{value}</span>
        {hint && <span className="summary-card__hint">{hint}</span>}
      </div>
      {icon && (
        <div className={`summary-card__icon summary-card__icon--${iconColor}`}>
          {icon}
        </div>
      )}
    </div>
  );
}

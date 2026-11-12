import { makeStyles, mergeClasses } from "@fluentui/react-components";

type Variant = "active" | "inactive" | "trial" | "expiring" | "expired" | "paid" | "pending" | "failed" | "overdue" | "draft" | "cancelled";

const DOT_COLORS: Record<Variant, string> = {
  active: "var(--color-success, #22c55e)",
  paid: "var(--color-success, #22c55e)",
  trial: "var(--color-primary, #3b82f6)",
  draft: "var(--text-muted, #94a3b8)",
  inactive: "var(--text-muted, #94a3b8)",
  cancelled: "var(--text-muted, #94a3b8)",
  pending: "var(--color-warning, #f59e0b)",
  expiring: "var(--color-warning, #f59e0b)",
  failed: "var(--color-danger, #ef4444)",
  expired: "var(--color-danger, #ef4444)",
  overdue: "var(--color-danger, #ef4444)",
};

const LABELS: Record<Variant, string> = {
  active: "Active",
  inactive: "Inactive",
  trial: "Trial",
  expiring: "Expiring soon",
  expired: "Expired",
  paid: "Paid",
  pending: "Pending",
  failed: "Failed",
  overdue: "Overdue",
  draft: "Draft",
  cancelled: "Cancelled",
};

const useStyles = makeStyles({
  root: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "var(--font-size-sm, 0.8125rem)",
    fontWeight: "500",
    whiteSpace: "nowrap",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  pill: {
    padding: "2px 10px",
    borderRadius: "9999px",
    fontSize: "var(--font-size-xs, 0.75rem)",
    fontWeight: "500",
    border: "1px solid",
  },
});

interface Props {
  variant: Variant;
  label?: string;
  pill?: boolean;
  className?: string;
}

export function StatusBadge({ variant, label, pill = false, className }: Props) {
  const s = useStyles();
  const color = DOT_COLORS[variant];
  const text = label ?? LABELS[variant];

  if (pill) {
    return (
      <span className={mergeClasses(s.pill, className)} style={{ color, borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)` }}>
        {text}
      </span>
    );
  }

  return (
    <span className={mergeClasses(s.root, className)} style={{ color: "var(--text-primary, #0f172a)" }}>
      <span className={s.dot} style={{ backgroundColor: color }} />
      {text}
    </span>
  );
}

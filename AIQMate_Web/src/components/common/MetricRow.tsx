import { makeStyles } from "@fluentui/react-components";

interface MetricItem {
  label: string;
  value: string | number;
  color?: "default" | "warning" | "danger";
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0",
    backgroundColor: "var(--card-bg, #ffffff)",
    border: "1px solid var(--card-border, #e2e8f0)",
    borderRadius: "var(--radius-md, 8px)",
    overflow: "hidden",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    flexGrow: 1,
    borderRight: "1px solid var(--card-border, #e2e8f0)",
    "&:last-child": { borderRight: "none" },
    "@media (max-width: 640px)": {
      borderRight: "none",
      borderBottom: "1px solid var(--card-border, #e2e8f0)",
      "&:last-child": { borderBottom: "none" },
    },
  },
  label: {
    fontSize: "var(--font-size-sm, 0.8125rem)",
    color: "var(--text-muted, #94a3b8)",
    whiteSpace: "nowrap",
  },
  value: {
    fontSize: "var(--font-size-base, 0.875rem)",
    fontWeight: "600",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
});

const COLORS: Record<string, string> = {
  default: "var(--text-primary, #0f172a)",
  warning: "var(--color-warning, #f59e0b)",
  danger: "var(--color-danger, #ef4444)",
};

export function MetricRow({ items }: { items: MetricItem[] }) {
  const s = useStyles();
  return (
    <div className={s.root}>
      {items.map((item) => (
        <div key={item.label} className={s.item}>
          <span className={s.label}>{item.label}</span>
          <span className={s.value} style={{ color: COLORS[item.color ?? "default"] }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

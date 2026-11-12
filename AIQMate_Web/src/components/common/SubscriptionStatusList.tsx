import { Badge, Text, makeStyles, tokens } from "@fluentui/react-components";
import { Diversity20Regular } from "@fluentui/react-icons";
import { StatusBadge } from "./StatusBadge";

interface SubscriptionItem {
  tenantName: string;
  plan: string;
  cycle: string;
  status: "active" | "expiring" | "expired" | "trial";
}

const useStyles = makeStyles({
  card: {
    backgroundColor: "var(--card-bg, #ffffff)",
    border: "1px solid var(--card-border, #e2e8f0)",
    borderRadius: "var(--radius-md, 8px)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "16px 20px 12px",
  },
  spacer: { flexGrow: 1 },
  viewAll: {
    fontSize: "var(--font-size-sm, 0.8125rem)",
    color: "var(--color-primary, #3b82f6)",
    textDecoration: "none",
    cursor: "pointer",
    fontWeight: "500",
    "&:hover": { textDecoration: "underline" },
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 20px",
    borderTop: "1px solid var(--card-border, #e2e8f0)",
    transitionProperty: "background-color",
    transitionDuration: tokens.durationNormal,
    "&:hover": { backgroundColor: "var(--page-bg, #f8fafc)" },
  },
  info: { display: "flex", flexDirection: "column", gap: "2px", flexGrow: 1, minWidth: 0 },
  name: { fontSize: "var(--font-size-sm, 0.8125rem)", fontWeight: "600", color: "var(--text-primary, #0f172a)" },
  detail: { fontSize: "var(--font-size-xs, 0.75rem)", color: "var(--text-muted, #94a3b8)" },
});

interface Props {
  items: SubscriptionItem[];
  onViewAll?: () => void;
}

export function SubscriptionStatusList({ items, onViewAll }: Props) {
  const s = useStyles();

  return (
    <div className={s.card}>
      <div className={s.header}>
        <Diversity20Regular style={{ color: "var(--color-primary, #3b82f6)" }} />
        <Text weight="semibold" size={300}>Subscription status</Text>
        <Badge appearance="filled" size="small" color="informative">{items.length}</Badge>
        <span className={s.spacer} />
        {onViewAll && (
          <span className={s.viewAll} onClick={onViewAll} role="link" tabIndex={0}>
            View all &gt;
          </span>
        )}
      </div>
      <div className={s.list}>
        {items.map((item, i) => (
          <div key={i} className={s.row}>
            <div className={s.info}>
              <span className={s.name}>{item.tenantName}</span>
              <span className={s.detail}>{item.plan} &middot; {item.cycle}</span>
            </div>
            <StatusBadge variant={item.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

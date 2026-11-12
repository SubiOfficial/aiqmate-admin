import { Badge, Text, makeStyles, tokens } from "@fluentui/react-components";
import {
  Alert20Regular,
  Info20Regular,
  Warning20Regular,
  type FluentIcon,
} from "@fluentui/react-icons";

interface AttentionItem {
  icon?: FluentIcon;
  title: string;
  description: string;
  severity: "info" | "warning" | "danger";
}

const SEVERITY_COLORS: Record<string, { bg: string; fg: string }> = {
  info: { bg: "var(--color-primary-light, #eff6ff)", fg: "var(--color-primary, #3b82f6)" },
  warning: { bg: "color-mix(in srgb, var(--color-warning, #f59e0b) 12%, transparent)", fg: "var(--color-warning, #f59e0b)" },
  danger: { bg: "color-mix(in srgb, var(--color-danger, #ef4444) 12%, transparent)", fg: "var(--color-danger, #ef4444)" },
};

const DEFAULT_ICONS: Record<string, FluentIcon> = {
  info: Info20Regular,
  warning: Warning20Regular,
  danger: Alert20Regular,
};

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
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  item: {
    display: "flex",
    gap: "12px",
    padding: "12px 20px",
    alignItems: "flex-start",
    borderTop: "1px solid var(--card-border, #e2e8f0)",
    transitionProperty: "background-color",
    transitionDuration: tokens.durationNormal,
    "&:hover": { backgroundColor: "var(--page-bg, #f8fafc)" },
  },
  iconCircle: {
    width: "36px",
    height: "36px",
    borderRadius: tokens.borderRadiusCircular,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  text: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
  title: { fontSize: "var(--font-size-sm, 0.8125rem)", fontWeight: "600", color: "var(--text-primary, #0f172a)" },
  desc: { fontSize: "var(--font-size-xs, 0.75rem)", color: "var(--text-muted, #94a3b8)", lineHeight: "1.4" },
});

export function AttentionCard({ items }: { items: AttentionItem[] }) {
  const s = useStyles();

  if (items.length === 0) return null;

  return (
    <div className={s.card}>
      <div className={s.header}>
        <Warning20Regular style={{ color: "var(--color-warning, #f59e0b)" }} />
        <Text weight="semibold" size={300}>Needs attention</Text>
        <Badge appearance="filled" size="small" color="warning">{items.length}</Badge>
      </div>
      <div className={s.list}>
        {items.map((item, i) => {
          const colors = SEVERITY_COLORS[item.severity];
          const Icon = item.icon ?? DEFAULT_ICONS[item.severity] ?? Info20Regular;
          return (
            <div key={i} className={s.item}>
              <span className={s.iconCircle} style={{ backgroundColor: colors.bg }}>
                <Icon style={{ color: colors.fg, fontSize: "18px" }} />
              </span>
              <div className={s.text}>
                <span className={s.title}>{item.title}</span>
                <span className={s.desc}>{item.description}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

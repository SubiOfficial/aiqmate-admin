import { makeStyles, tokens } from "@fluentui/react-components";

const PALETTE = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const SIZES = { sm: 28, md: 36, lg: 48 } as const;
const FONT_SIZES = { sm: "0.65rem", md: "0.78rem", lg: "1rem" } as const;

const useStyles = makeStyles({
  root: {
    borderRadius: tokens.borderRadiusCircular,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    color: "#ffffff",
    flexShrink: 0,
    letterSpacing: "0.02em",
  },
});

export function TenantAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const s = useStyles();
  const bg = PALETTE[hashName(name) % PALETTE.length];
  const px = SIZES[size];
  return (
    <span
      className={s.root}
      style={{ width: px, height: px, fontSize: FONT_SIZES[size], backgroundColor: bg }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

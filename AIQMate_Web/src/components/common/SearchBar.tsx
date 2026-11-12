import { makeStyles } from "@fluentui/react-components";
import { Search20Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  root: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "var(--card-bg, #ffffff)",
    border: "1px solid var(--card-border, #e2e8f0)",
    borderRadius: "var(--radius-md, 8px)",
    padding: "0 12px",
    height: "40px",
  },
  icon: { color: "var(--text-muted, #94a3b8)", display: "flex", alignItems: "center", flexShrink: 0 },
  input: {
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    fontSize: "var(--font-size-sm, 0.8125rem)",
    color: "var(--text-primary, #0f172a)",
    flexGrow: 1,
    minWidth: 0,
  },
  kbd: {
    fontSize: "0.65rem",
    fontWeight: "500",
    color: "var(--text-muted, #94a3b8)",
    backgroundColor: "var(--page-bg, #f8fafc)",
    border: "1px solid var(--card-border, #e2e8f0)",
    borderRadius: "4px",
    padding: "2px 6px",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
});

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showShortcut?: boolean;
}

export function SearchBar({ value, onChange, placeholder = "Search...", showShortcut = false }: Props) {
  const s = useStyles();
  return (
    <div className={s.root}>
      <span className={s.icon}><Search20Regular /></span>
      <input
        className={s.input}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {showShortcut && <kbd className={s.kbd}>Ctrl K</kbd>}
    </div>
  );
}

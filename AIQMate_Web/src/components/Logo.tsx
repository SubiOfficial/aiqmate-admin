import { Text, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  root: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  mate: { color: tokens.colorBrandForeground1 },
});

export function Logo({ size = 32, withWord = true }: { size?: number; withWord?: boolean }) {
  const s = useStyles();
  return (
    <span className={s.root}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0058CC" />
        <path d="M9 22.5 14.6 9h2.8L23 22.5h-3l-1.2-3h-5.6l-1.2 3H9Zm5.1-5.6h3.8L16 12l-1.9 4.9Z" fill="#fff" />
      </svg>
      {withWord && (
        <Text weight="semibold" size={500}>
          AiQ<span className={s.mate}>Mate</span>
        </Text>
      )}
    </span>
  );
}

// A centred card for pages outside the shell: sign-in problems, signed out, no access, errors.

import { Card, Spinner, Text, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

const useStyles = makeStyles({
  page: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalL}`,
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  column: { width: "100%", maxWidth: "440px", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXL },
  logo: { display: "flex", justifyContent: "center" },
  card: { padding: tokens.spacingHorizontalXXL, gap: tokens.spacingVerticalM },
  body: {
    color: tokens.colorNeutralForeground2,
    overflowWrap: "anywhere",
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalS },
});

export function FullPage({
  title,
  children,
  actions,
  icon,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  const s = useStyles();
  return (
    <main className={s.page}>
      <div className={s.column}>
        <div className={s.logo}>
          <Logo size={36} />
        </div>
        <Card className={s.card}>
          {icon}
          <Text as="h1" size={500} weight="semibold">
            {title}
          </Text>
          {/* A div, not a <p>: callers pass forms and message bars, which may not sit inside a
              paragraph (the browser logged it as invalid nesting). */}
          {children && <div className={s.body}>{children}</div>}
          {actions && <div className={s.actions}>{actions}</div>}
        </Card>
      </div>
    </main>
  );
}

export function FullPageSpinner({ label = "Loading" }: { label?: string }) {
  const s = useStyles();
  return (
    <main className={s.page} aria-busy="true">
      <Spinner label={label} />
    </main>
  );
}

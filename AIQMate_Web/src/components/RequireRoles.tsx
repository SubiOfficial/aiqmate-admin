// SPEC-036 US-002 AC-4 / FR-WEB-012. A page a role may not open says so instead of rendering.
// The API still enforces every rule; this keeps users from pages that would only fail.

import { Card, Text, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactNode } from "react";
import { effectiveRoles, hasAnyRole, homePathFor, type Role } from "@/lib/auth/roles";
import { useSession } from "@/lib/auth/session";
import { TextLink } from "./TextLink";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalXXL, alignItems: "center", textAlign: "center", gap: tokens.spacingVerticalS },
});

export function RequireRoles({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const s = useStyles();
  const session = useSession();
  // effectiveRoles: a Super Admin passes only platform gates, never a tenant one (ADR-012 §7).
  if (hasAnyRole(effectiveRoles(session.roles), roles)) return <>{children}</>;
  return (
    <Card className={s.card}>
      <Text as="h1" size={500} weight="semibold">
        Your role cannot open this page
      </Text>
      <Text>Ask your administrator if you need access.</Text>
      <TextLink to={homePathFor(session.roles)}>Go to your home page</TextLink>
    </Card>
  );
}

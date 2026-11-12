// SPEC-036 US-005 (dev role picker). In entra mode this page only forwards to Microsoft sign-in.

import { Button, Field, MessageBar, MessageBarBody, Select, makeStyles, tokens } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { FullPage, FullPageSpinner } from "@/components/FullPage";
import { goTo, loginUrl, writeDevRole } from "@/lib/api/client";
import { useConfig } from "@/lib/api/config";
import { PORTAL_ROLES, ROLES, ROLE_LABEL, type Role } from "@/lib/auth/roles";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginTop: tokens.spacingVerticalS },
});

export function LoginPage() {
  const config = useConfig();
  const s = useStyles();
  const [role, setRole] = useState<Role>("ORG_ADMIN");

  useEffect(() => {
    if (config.authMode === "entra") goTo(loginUrl("/dashboard"));
  }, [config.authMode]);

  if (config.authMode === "entra") return <FullPageSpinner label="Opening Microsoft sign-in" />;

  return (
    <FullPage title="Sign in to the portal">
      For managers, supervisors and administrators. Field work stays in the AiQMate mobile app.
      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          writeDevRole(role);
          goTo("/dashboard");
        }}
      >
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>Dev sign-in. api-service runs with AUTH_MODE=dev. Data is the demo-org seed.</MessageBarBody>
        </MessageBar>
        <Field label="Role">
          <Select value={role} onChange={(_, d) => setRole(d.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
                {PORTAL_ROLES.includes(r) ? "" : " (no portal access)"}
              </option>
            ))}
          </Select>
        </Field>
        <Button appearance="primary" type="submit">
          Continue
        </Button>
      </form>
    </FullPage>
  );
}

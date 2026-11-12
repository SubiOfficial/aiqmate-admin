// SPEC-036 US-004 AC-1. Where the browser lands after Sign out.

import { Button } from "@fluentui/react-components";
import { FullPage } from "@/components/FullPage";
import { goTo, loginUrl } from "@/lib/api/client";
import { useConfig } from "@/lib/api/config";

export function SignedOutPage() {
  const config = useConfig();
  return (
    <FullPage
      title="You are signed out"
      actions={
        <Button appearance="primary" onClick={() => goTo(config.authMode === "dev" ? "/login" : loginUrl("/dashboard"))}>
          Sign in again
        </Button>
      }
    >
      Close this window if you are on a shared computer.
    </FullPage>
  );
}

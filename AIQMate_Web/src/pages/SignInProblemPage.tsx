// SPEC-036 US-001 AC-4/AC-5. api-service sends a failed sign-in here with ?code=.

import { Button } from "@fluentui/react-components";
import { ErrorCircle24Regular } from "@fluentui/react-icons";
import { FullPage } from "@/components/FullPage";
import { goTo, loginUrl } from "@/lib/api/client";
import { useConfig } from "@/lib/api/config";
import { signInProblemMessage } from "@/lib/auth/sign-in-problems";

export function SignInProblemPage({ code }: { code: string | undefined }) {
  const config = useConfig();
  return (
    <FullPage
      title="You could not be signed in"
      icon={<ErrorCircle24Regular aria-hidden="true" />}
      actions={
        <Button appearance="primary" onClick={() => goTo(config.authMode === "dev" ? "/login" : loginUrl("/dashboard"))}>
          Try again
        </Button>
      }
    >
      {signInProblemMessage(code)}
    </FullPage>
  );
}

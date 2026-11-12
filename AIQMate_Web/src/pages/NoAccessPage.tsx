// SPEC-036 US-002 AC-2. A signed-in user whose roles give no portal access (an Operator).

import { Button } from "@fluentui/react-components";
import { Phone24Regular } from "@fluentui/react-icons";
import { FullPage } from "@/components/FullPage";
import { signOut } from "@/lib/auth/sign-out";

export function NoAccessPage() {
  return (
    <FullPage
      title="Your work is in the mobile app"
      icon={<Phone24Regular aria-hidden="true" />}
      actions={<Button onClick={() => void signOut()}>Sign out</Button>}
    >
      The portal is for supervisors, managers, experts and administrators. Open AiQMate on your phone to see your
      tasks.
    </FullPage>
  );
}

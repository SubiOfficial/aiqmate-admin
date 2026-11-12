// SPEC-036 FR-WEB-023. Nothing renders until the deployment's config has loaded.

import { Button } from "@fluentui/react-components";
import type { ReactNode } from "react";
import { useConfigQuery } from "@/lib/api/config";
import { FullPage, FullPageSpinner } from "./FullPage";

export function ConfigGate({ children }: { children: ReactNode }) {
  const config = useConfigQuery();
  if (config.isPending) return <FullPageSpinner />;
  if (config.isError) {
    return (
      <FullPage
        title="The AiQMate service could not be reached."
        actions={
          <Button appearance="primary" onClick={() => void config.refetch()}>
            Try again
          </Button>
        }
      >
        Check your connection, then try again.
      </FullPage>
    );
  }
  return <>{children}</>;
}

// SPEC-036 US-001 AC-1, US-002 AC-2, US-004 AC-5. Nothing behind sign-in renders until the
// session is known; Operators go to /no-access; a new user means a clean cache.

import { Button } from "@fluentui/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { canUsePortal } from "@/lib/auth/roles";
import { NoDevIdentity, SessionContext, useSessionQuery } from "@/lib/auth/session";
import { FullPage, FullPageSpinner } from "./FullPage";

export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useSessionQuery();
  const userId = session.data?.user.id ?? null;
  const lastUser = useRef<string | null>(null);

  // A different person means none of the cached answers are theirs.
  useEffect(() => {
    if (userId && lastUser.current && lastUser.current !== userId) {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" && q.queryKey[0] !== "config" });
    }
    if (userId) lastUser.current = userId;
  }, [userId, queryClient]);

  if (session.isPending) return <FullPageSpinner />;

  if (session.isError) {
    if (session.error instanceof NoDevIdentity) return <Navigate to="/login" />;
    // A 401 has already sent the browser to sign in (client.ts); show a spinner meanwhile.
    if (session.error instanceof ApiError && session.error.status === 401) return <FullPageSpinner label="Signing in" />;
    return (
      <FullPage
        title="The AiQMate service could not be reached."
        actions={
          <Button appearance="primary" onClick={() => void session.refetch()}>
            Try again
          </Button>
        }
      >
        Check your connection, then try again.
      </FullPage>
    );
  }

  if (!canUsePortal(session.data.roles)) return <Navigate to="/no-access" />;

  return <SessionContext.Provider value={session.data}>{children}</SessionContext.Provider>;
}

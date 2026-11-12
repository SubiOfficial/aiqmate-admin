// Test helper: render a page inside the providers it needs (Fluent theme, a fresh query client, a
// signed-in session). Pages that use router links mock @tanstack/react-router in their own test.

import { FluentProvider } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { setAuthMode } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import { SessionContext, type Session } from "@/lib/auth/session";
import { lightTheme } from "@/theme";

export function renderWithSession(ui: ReactElement, roles: Role[]) {
  setAuthMode("entra");
  const session: Session = { user: { id: `u-${roles.join("-")}`, orgId: "o", email: null, displayName: "Pat Lee" }, roles };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <FluentProvider theme={lightTheme}>
      <QueryClientProvider client={client}>
        <SessionContext.Provider value={session}>{ui}</SessionContext.Provider>
      </QueryClientProvider>
    </FluentProvider>,
  );
}

/** Replaces fetch with a router of path prefix to JSON body; anything else answers 404. */
export function stubJson(routes: Record<string, unknown>) {
  const fn = async (url: string) => {
    const path = String(url);
    const hit = Object.keys(routes).find((prefix) => path.startsWith(prefix));
    return hit ? new Response(JSON.stringify(routes[hit])) : new Response("{}", { status: 404 });
  };
  return fn;
}

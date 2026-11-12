// SPEC-036 US-004 AC-1. Sign out ends the server session, then reloads into a clean page so no
// cached data survives.

import { apiFetch, clearDevRole, getAuthMode, goTo } from "@/lib/api/client";

export async function signOut(): Promise<void> {
  if (getAuthMode() === "dev") {
    clearDevRole();
    goTo("/login");
    return;
  }
  try {
    await apiFetch<void>("/web-auth/logout", { method: "POST", skipAuthRedirect: true });
  } catch {
    // The cookie may already be gone; the signed-out page is still the right place.
  }
  goTo("/signed-out");
}

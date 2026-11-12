// SPEC-036 US-001 / US-005. Who is signed in. Entra: GET /users/me, carried by the session cookie.
// Dev: built from the picked role, because synthetic dev users have no row for /users/me.

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { ApiError, DEV_ORG_ID, apiFetch, devUserId, getAuthMode, readDevRole } from "@/lib/api/client";
import { ROLE_LABEL, toRole, type Role } from "./roles";

export interface PortalUser {
  id: string;
  orgId: string;
  email: string | null;
  displayName: string;
}

export interface Session {
  user: PortalUser;
  roles: Role[];
}

interface ApiUser {
  id: string;
  orgId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface MeResponse {
  user: ApiUser;
  roles: { role: string }[];
}

export function toPortalUser(u: ApiUser): PortalUser {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return { id: u.id, orgId: u.orgId, email: u.email ?? null, displayName: name || u.email || "Signed in" };
}

export function rolesOf(me: MeResponse): Role[] {
  const out = new Set<Role>();
  for (const r of me.roles ?? []) {
    const role = toRole(r.role);
    if (role) out.add(role);
  }
  return [...out];
}

export function sessionFromMe(me: MeResponse): Session {
  return { user: toPortalUser(me.user), roles: rolesOf(me) };
}

export function devSession(role: Role): Session {
  return {
    user: { id: devUserId(role), orgId: DEV_ORG_ID, email: null, displayName: `Dev ${ROLE_LABEL[role]}` },
    roles: [role],
  };
}

/** Thrown in dev mode when no role has been picked yet; the gate sends the user to /login. */
export class NoDevIdentity extends Error {
  constructor() {
    super("No dev identity");
    this.name = "NoDevIdentity";
  }
}

export async function fetchSession(): Promise<Session> {
  if (getAuthMode() === "dev") {
    const role = readDevRole();
    if (!role) throw new NoDevIdentity();
    return devSession(role);
  }
  return sessionFromMe(await apiFetch<MeResponse>("/users/me"));
}

export function useSessionQuery() {
  return useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    staleTime: 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && !(error instanceof NoDevIdentity) && count < 2,
  });
}

/** Provided by AuthGate to everything under the portal shell. */
export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession used outside AuthGate");
  return session;
}

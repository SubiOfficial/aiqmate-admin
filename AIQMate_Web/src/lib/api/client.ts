// SPEC-036 FR-WEB-020..021. Every call to api-service goes through apiFetch. The browser holds no
// token: in entra mode the HttpOnly `aiq_session` cookie travels by itself (same site), and changes
// carry the CSRF header. In dev mode (AUTH_MODE=dev) the picked role is sent as dev-auth headers.

import { DEV_HEADER_ROLE, isRole, type Role } from "@/lib/auth/roles";

export type AuthMode = "entra" | "dev";

export class ApiError extends Error {
  readonly status: number;
  /** The API's machine code from a `{ code }` body, e.g. SESSION_REVOKED, CSRF_FAILED. */
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const API_PREFIX = "/api/v1";
export const XSRF_COOKIE = "aiq_xsrf";
export const XSRF_HEADER = "X-XSRF-TOKEN";
export const DEV_IDENTITY_KEY = "aiqmate.portal.devIdentity";
export const DEV_ORG_ID = "demo-org";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let authMode: AuthMode = "entra";
let redirect: (url: string) => void = (url) => window.location.assign(url);

/** Set once from GET /web-auth/config (FR-WEB-023). */
export function setAuthMode(mode: AuthMode): void {
  authMode = mode;
}
export function getAuthMode(): AuthMode {
  return authMode;
}

/** Tests replace the full-page navigation. */
export function setRedirect(fn: (url: string) => void): void {
  redirect = fn;
}
export function goTo(url: string): void {
  redirect(url);
}

/** The sign-in entry point for a path the user wanted (US-001 AC-1). */
export function loginUrl(returnTo: string): string {
  return `${API_PREFIX}/web-auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function readCookie(name: string): string | null {
  for (const part of document.cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

// ---- Dev identity (AUTH_MODE=dev only, US-005) ----

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDevRole(): Role | null {
  const raw = storage()?.getItem(DEV_IDENTITY_KEY) ?? null;
  return isRole(raw) ? raw : null;
}
export function writeDevRole(role: Role): void {
  storage()?.setItem(DEV_IDENTITY_KEY, role);
}
export function clearDevRole(): void {
  storage()?.removeItem(DEV_IDENTITY_KEY);
}
export function devUserId(role: Role): string {
  return `dev-${role.toLowerCase().replace(/_/g, "-")}`;
}

export function devHeaders(role: Role | null): Record<string, string> {
  if (!role) return {};
  return { "x-user-id": devUserId(role), "x-org-id": DEV_ORG_ID, "x-user-role": DEV_HEADER_ROLE[role] };
}

// ---- Fetch ----

export interface ApiFetchOptions extends Omit<RequestInit, "body" | "credentials"> {
  json?: unknown;
  /** Do not start sign-in on a 401 (public calls, sign-out). */
  skipAuthRedirect?: boolean;
}

async function readError(res: Response): Promise<ApiError> {
  let code: string | null = null;
  let message = `Request failed (${res.status})`;
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      if (typeof b.code === "string") code = b.code;
      if (typeof b.message === "string") message = b.message;
      else if (Array.isArray(b.message)) message = b.message.join(". ");
    }
  } catch {
    // Not JSON: keep the generic message.
  }
  return new ApiError(res.status, code, message);
}

/** FR-WEB-021: where a 401 sends the browser. */
export function handleUnauthorized(): void {
  if (authMode === "dev") {
    clearDevRole();
    goTo("/login");
    return;
  }
  goTo(loginUrl(`${window.location.pathname}${window.location.search}`));
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, skipAuthRedirect, headers, method = "GET", ...init } = options;
  const upper = method.toUpperCase();
  const xsrf = UNSAFE_METHODS.has(upper) ? readCookie(XSRF_COOKIE) : null;

  const res = await fetch(`${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    method: upper,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(xsrf ? { [XSRF_HEADER]: xsrf } : {}),
      ...(authMode === "dev" ? devHeaders(readDevRole()) : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  if (!res.ok) {
    const error = await readError(res);
    if (res.status === 401 && !skipAuthRedirect) handleUnauthorized();
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  DEV_IDENTITY_KEY,
  apiFetch,
  devHeaders,
  loginUrl,
  readDevRole,
  setAuthMode,
  setRedirect,
  writeDevRole,
} from "../client";

type FetchMock = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

function mockFetch(status: number, body?: unknown): FetchMock {
  const fn = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
    async () => new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function headersOf(fn: FetchMock, call = 0): Record<string, string> {
  return fn.mock.calls[call][1].headers as Record<string, string>;
}

const redirects: string[] = [];

beforeEach(() => {
  redirects.length = 0;
  setRedirect((url) => redirects.push(url));
  setAuthMode("entra");
  document.cookie = "aiq_xsrf=xsrf-123; path=/";
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "aiq_xsrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("apiFetch (FR-WEB-020)", () => {
  it("calls /api/v1 with same-origin credentials and no token", async () => {
    const fn = mockFetch(200, { ok: 1 });
    await expect(apiFetch("/dashboard/home")).resolves.toEqual({ ok: 1 });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("/api/v1/dashboard/home");
    expect(init.credentials).toBe("same-origin");
    expect(headersOf(fn).Authorization).toBeUndefined();
  });

  it("sends X-XSRF-TOKEN from the aiq_xsrf cookie on changes only", async () => {
    const fn = mockFetch(200, {});
    await apiFetch("/x", { method: "POST", json: { a: 1 } });
    await apiFetch("/x", { method: "delete" });
    await apiFetch("/x");
    expect(headersOf(fn, 0)["X-XSRF-TOKEN"]).toBe("xsrf-123");
    expect(headersOf(fn, 1)["X-XSRF-TOKEN"]).toBe("xsrf-123");
    expect(headersOf(fn, 2)["X-XSRF-TOKEN"]).toBeUndefined();
  });

  it("sends the dev-auth headers in dev mode only", async () => {
    const fn = mockFetch(200, {});
    writeDevRole("MANAGER");
    await apiFetch("/x");
    expect(headersOf(fn, 0)["x-user-id"]).toBeUndefined();
    setAuthMode("dev");
    await apiFetch("/x");
    expect(headersOf(fn, 1)).toMatchObject({ "x-user-id": "dev-manager", "x-org-id": "demo-org", "x-user-role": "Manager" });
  });

  it("raises ApiError with the API's code and message", async () => {
    mockFetch(403, { code: "CSRF_FAILED", message: "nope" });
    await expect(apiFetch("/x", { method: "POST" })).rejects.toMatchObject({ status: 403, code: "CSRF_FAILED", message: "nope" });
  });

  it("joins validation message arrays", async () => {
    mockFetch(400, { message: ["a is wrong", "b is wrong"] });
    await expect(apiFetch("/x")).rejects.toMatchObject({ message: "a is wrong. b is wrong" });
  });

  it("returns undefined for 204", async () => {
    mockFetch(204);
    await expect(apiFetch("/web-auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });
});

describe("401 handling (FR-WEB-021)", () => {
  it("entra: starts sign-in with the current path and query, encoded", async () => {
    window.history.pushState({}, "", "/not-built/users?tab=a&b=c");
    mockFetch(401, { code: "SESSION_REVOKED" });
    await expect(apiFetch("/users/me")).rejects.toBeInstanceOf(ApiError);
    expect(redirects).toEqual(["/api/v1/web-auth/login?returnTo=%2Fnot-built%2Fusers%3Ftab%3Da%26b%3Dc"]);
  });

  it("dev: clears the dev identity and returns to /login", async () => {
    setAuthMode("dev");
    writeDevRole("SUPERVISOR");
    mockFetch(401, {});
    await expect(apiFetch("/x")).rejects.toBeInstanceOf(ApiError);
    expect(readDevRole()).toBeNull();
    expect(window.sessionStorage.getItem(DEV_IDENTITY_KEY)).toBeNull();
    expect(redirects).toEqual(["/login"]);
  });

  it("does not redirect when the caller opts out", async () => {
    mockFetch(401, {});
    await expect(apiFetch("/web-auth/config", { skipAuthRedirect: true })).rejects.toBeInstanceOf(ApiError);
    expect(redirects).toEqual([]);
  });
});

describe("helpers", () => {
  it("builds the sign-in URL", () => {
    expect(loginUrl("/dashboard")).toBe("/api/v1/web-auth/login?returnTo=%2Fdashboard");
  });
  it("builds no dev headers without a role", () => {
    expect(devHeaders(null)).toEqual({});
  });
});

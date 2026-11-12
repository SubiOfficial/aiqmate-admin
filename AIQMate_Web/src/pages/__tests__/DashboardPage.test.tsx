import { FluentProvider } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setAuthMode } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import { SessionContext, type Session } from "@/lib/auth/session";
import { lightTheme } from "@/theme";
import { DashboardPage } from "../DashboardPage";

// The page redirects a platform-role user; render the redirect as a marker instead of needing a router.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}));

const HOME = {
  kpis: { tasks: { count: 12, inProgress: 3 }, procedures: 40, routines: 7, inspections: 5, bda: 2, audits: 9, areaMaps: 4 },
};
const SUMMARY = {
  role: "supervisor",
  kpis: { procedures: 40, activities: 21, pendingApprovals: 6, assets: 15 },
  recentActivities: [{ id: "a1", title: "Oil change · Pump 1", status: "IN_PROGRESS", assignedTo: null, createdAt: "2026-11-03T10:00:00Z" }],
};

function stubApi() {
  const fn = vi.fn(async (url: string) => {
    if (url.startsWith("/api/v1/dashboard/home")) return new Response(JSON.stringify(HOME));
    if (url.startsWith("/api/v1/dashboard/summary")) return new Response(JSON.stringify(SUMMARY));
    if (url.startsWith("/api/v1/approvals")) return new Response(JSON.stringify({ items: [], page: 1, limit: 1, total: 8 }));
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function renderAs(roles: Role[]) {
  setAuthMode("entra");
  const session: Session = { user: { id: `u-${roles.join("-")}`, orgId: "o", email: null, displayName: "Pat Lee" }, roles };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <FluentProvider theme={lightTheme}>
      <QueryClientProvider client={client}>
        <SessionContext.Provider value={session}>
          <DashboardPage />
        </SessionContext.Provider>
      </QueryClientProvider>
    </FluentProvider>,
  );
}

const calledUrls = (fn: ReturnType<typeof stubApi>) => fn.mock.calls.map((c) => String(c[0]));

afterEach(() => vi.unstubAllGlobals());

describe("DashboardPage (SPEC-036 US-003)", () => {
  it("shows the org counts for every portal role", async () => {
    stubApi();
    renderAs(["EXPERT"]);
    expect(await screen.findByText("40")).toBeInTheDocument();
    expect(screen.getByText("Open tasks")).toBeInTheDocument();
    expect(screen.getByText("3 in progress")).toBeInTheDocument();
    expect(screen.getByText("Area maps")).toBeInTheDocument();
  });

  it("shows Waiting for approval to an approver", async () => {
    const fn = stubApi();
    renderAs(["MANAGER"]);
    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(await screen.findByText("8")).toBeInTheDocument();
    expect(calledUrls(fn).some((u) => u.startsWith("/api/v1/approvals"))).toBe(true);
  });

  it("hides Waiting for approval from an Expert and does not ask for it", async () => {
    const fn = stubApi();
    renderAs(["EXPERT"]);
    await screen.findByText("40");
    expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
    expect(calledUrls(fn).some((u) => u.startsWith("/api/v1/approvals"))).toBe(false);
  });

  it("shows Your line only to a supervisor", async () => {
    stubApi();
    renderAs(["SUPERVISOR"]);
    expect(await screen.findByText("Your line")).toBeInTheDocument();
    expect(await screen.findByText("Oil change · Pump 1")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("shows the error panel with Try again when the service fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    renderAs(["ORG_ADMIN"]);
    expect(await screen.findByText("The AiQMate service could not be reached.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  // ADR-012 §7 / FR-WEB-013: the dashboard is customer data; the Super Admin never asks for it.
  it.each([[["SUPER_ADMIN"]], [["SUPER_ADMIN", "ORG_ADMIN"]]] as Role[][][])(
    "sends a Super Admin (%j) to /platform without one customer-data request",
    async (roles) => {
      const fn = stubApi();
      renderAs(roles);
      expect(await screen.findByTestId("navigate")).toHaveTextContent("/platform");
      expect(screen.queryByText("Open tasks")).not.toBeInTheDocument();
      expect(fn).not.toHaveBeenCalled();
    },
  );
});

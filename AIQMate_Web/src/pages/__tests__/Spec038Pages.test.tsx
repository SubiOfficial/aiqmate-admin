import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantSummary } from "@/lib/api/platform";
import type { OrgOverview, TrailPage } from "@/lib/api/orgAdmin";
import { renderWithSession, stubJson } from "@/test/renderWithSession";
import { ActivityTrailPage } from "../ActivityTrailPage";
import { MonitoringPage } from "../MonitoringPage";
import { PlatformPage } from "../PlatformPage";
import { TenantsTable } from "../TenantsPage";

// Router links render as plain anchors here; no router is needed to check the content.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

afterEach(() => vi.unstubAllGlobals());

const MONTHLY = [{ month: "2026-10", tasksCreated: 12, tasksCompleted: 9, proceduresPublished: 2 }];

const TENANT: TenantSummary = {
  orgId: "org-a",
  name: "Acme Pumps",
  industry: "Manufacturing",
  country: "US",
  subscription: { status: "TRIAL", trialEndsAt: "2026-11-08T00:00:00Z" },
  seats: { limit: 10, used: 9 },
  primaryContact: { id: "c1", name: "Jo Rivera", title: null, email: "jo@acme.example", phone: null, contactType: "PRIMARY", updatedAt: "2026-11-01T00:00:00Z" },
  contactCount: 1,
  activeUsers30d: 4,
  lastActivityAt: "2026-11-02T00:00:00Z",
  health: "ATTENTION",
  reasons: ["TRIAL_ENDING_SOON", "SEATS_NEARLY_FULL", "FEW_CONTACTS"],
};

const OVERVIEW: OrgOverview = {
  procedures: { draft: 3, pendingApproval: 2, published: 17, archived: 1, publishedLast30d: 4 },
  routines: { active: 6, inactive: 1, inspectionsPublished: 3 },
  tasks: { open: 8, inProgress: 5, submittedForReview: 2, redoRequired: 1, overdue: 4, createdLast30d: 30, completedLast30d: 22 },
  audits: { total: 9, last30d: 2 },
  bdas: { total: 3, last30d: 1 },
  monthly: MONTHLY,
};

const DASHBOARD_SUMMARY = {
  tenants: { total: 7, active: 4, inactive: 3 },
  users: { total: 38 },
  procedures: { total: 120, billable: 95, nonBillable: 25 },
  revenue: { totalInvoiced: "5000.00", totalCollected: "3200.00", totalOutstanding: "1800.00", totalRefunded: "0.00", currency: "USD" },
  subscriptions: { active: 4, expiringSoon: 1, expired: 1, trial: 2 },
  payments: { pending: 2, failed: 1 },
};

const DASHBOARD_TENANTS = {
  items: [{ id: "t1", orgId: "acme", name: "Acme Pumps", industry: "Manufacturing", country: "US", status: "ACTIVE", health: "OK", subscription: { plan: "PROFESSIONAL", status: "ACTIVE", model: "USAGE_BASED", startDate: "2026-01-01", endDate: null, trialEndsAt: null, renewalDate: null, billingCycle: "MONTHLY", monthlyRate: "500.00", currency: "USD" }, primaryContact: null, procedures: { total: 50, billable: 40 }, billing: { invoiced: "2000.00", paid: "1500.00", outstanding: "500.00" }, lastPaymentDate: null, lastActivityAt: null, assetCount: 10, seatsUsed: 5, seatLimit: 20, createdAt: "2026-01-01" }],
  total: 7, page: 1, limit: 5,
};

const DASHBOARD_SUBS = { items: [] };

describe("PlatformPage (SPEC-038 US-003 AC-2)", () => {
  it("shows the dashboard summary cards with database-driven values", async () => {
    const fn = vi.fn(stubJson({
      "/api/v1/dashboard/summary": DASHBOARD_SUMMARY,
      "/api/v1/dashboard/tenants-detail": DASHBOARD_TENANTS,
      "/api/v1/dashboard/subscriptions-expiry": DASHBOARD_SUBS,
    }));
    vi.stubGlobal("fetch", fn);
    renderWithSession(<PlatformPage />, ["SUPER_ADMIN"]);
    expect(await screen.findByText("4 active, 3 inactive")).toBeInTheDocument();
    expect(screen.getByText("Acme Pumps")).toBeInTheDocument();
    const urls = fn.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/dashboard/summary"))).toBe(true);
  });
});

describe("TenantsTable (SPEC-038 US-001)", () => {
  it("shows health reasons as words, never as codes", () => {
    renderWithSession(<TenantsTable items={[TENANT]} />, ["SUPER_ADMIN"]);
    expect(screen.getByText("Trial ends within 7 days")).toBeInTheDocument();
    expect(screen.getByText("Seats nearly full")).toBeInTheDocument();
    expect(screen.getByText("Fewer than 2 contacts")).toBeInTheDocument();
    expect(screen.queryByText("TRIAL_ENDING_SOON")).not.toBeInTheDocument();
    expect(screen.getByText("9 of 10")).toBeInTheDocument();
    expect(screen.getByText("jo@acme.example")).toBeInTheDocument();
  });

  it("says when there are no tenants", () => {
    renderWithSession(<TenantsTable items={[]} />, ["SUPER_ADMIN"]);
    expect(screen.getByText("No customer organisations yet.")).toBeInTheDocument();
  });
});

describe("MonitoringPage (SPEC-038 US-004)", () => {
  it("shows the organisation's counts with overdue tasks", async () => {
    vi.stubGlobal("fetch", vi.fn(stubJson({ "/api/v1/org-admin/overview": OVERVIEW })));
    renderWithSession(<MonitoringPage />, ["ORG_ADMIN"]);
    expect(await screen.findByText("Tasks overdue")).toBeInTheDocument();
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
    expect(screen.getByText("Submitted for review")).toBeInTheDocument();
    expect(screen.getByText("Oct 2026")).toBeInTheDocument();
  });

  it("is refused to a role other than Org Admin without calling the API", () => {
    const fn = vi.fn(stubJson({}));
    vi.stubGlobal("fetch", fn);
    renderWithSession(<MonitoringPage />, ["MANAGER"]);
    expect(screen.getByText("Your role cannot open this page")).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("platform pages are closed to tenant roles", () => {
  it("never sends a platform request for an Org Admin", () => {
    const fn = vi.fn(stubJson({}));
    vi.stubGlobal("fetch", fn);
    renderWithSession(<PlatformPage />, ["ORG_ADMIN"]);
    expect(screen.getByText("Your role cannot open this page")).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("ActivityTrailPage (SPEC-038 US-005)", () => {
  const PAGE: TrailPage = {
    items: [
      {
        id: "e1",
        occurredAt: "2026-11-03T09:00:00Z",
        source: "TASK",
        action: "STATUS_CHANGED",
        summary: "Moved the task from Open to In progress.",
        actor: { id: "u1", name: "Sam Ortiz" },
        subject: { type: "TASK", id: "t1", title: "Oil change · Pump 1" },
      },
    ],
    page: 1,
    limit: 50,
    total: 120,
  };

  it("sends the page and the source filter in the query string", async () => {
    const fn = vi.fn(stubJson({ "/api/v1/org-admin/trail": PAGE }));
    vi.stubGlobal("fetch", fn);
    renderWithSession(<ActivityTrailPage />, ["ORG_ADMIN"]);
    expect(await screen.findByText("Sam Ortiz")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(fn.mock.calls.some((c) => String(c[0]).includes("page=2"))).toBe(true));

    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: "CONTENT" } });
    await waitFor(() =>
      expect(fn.mock.calls.some((c) => /source=CONTENT/.test(String(c[0])) && /page=1/.test(String(c[0])))).toBe(true),
    );
  });
});

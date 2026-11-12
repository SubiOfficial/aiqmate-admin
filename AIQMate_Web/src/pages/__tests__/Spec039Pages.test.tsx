import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomFieldsForm } from "@/components/CustomFieldsForm";
import { useOrgMetadata } from "@/lib/api/metadata";
import { useSession } from "@/lib/auth/session";
import { fieldFixture, metadataFixture } from "@/test/metadataFixture";
import { renderWithSession, stubJson } from "@/test/renderWithSession";
import { ConfigurationPage, modulesPayload, modulesProblem } from "../ConfigurationPage";
import { ModulePage } from "../ModulePage";
import { MonitoringPage } from "../MonitoringPage";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

afterEach(() => vi.unstubAllGlobals());

const urls = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map((c) => String(c[0]));

const LOOKUP = {
  data: [
    {
      id: "p1",
      templateId: "PM-042",
      title: "Oil change · Pump 1",
      type: "PROCEDURE",
      status: "PUBLISHED",
      category: "MAINTENANCE",
      assetName: "Pump 1",
      updatedAt: "2026-11-02T10:00:00Z",
      createdByName: "Sam Ortiz",
    },
  ],
  meta: { total: 1 },
};

describe("ModulePage (SPEC-039 US-001, US-002)", () => {
  it("titles the page with the tenant's name and lists from Lookup (US-002 AC-1)", async () => {
    const fn = vi.fn(
      stubJson({
        "/api/v1/org-metadata": metadataFixture({ PROCEDURE: { singular: "SOP", plural: "SOPs" } }),
        "/api/v1/lookup": LOOKUP,
      }),
    );
    vi.stubGlobal("fetch", fn);
    renderWithSession(<ModulePage slug="procedures" />, ["MANAGER"]);
    expect(await screen.findByRole("heading", { name: "SOPs" })).toBeInTheDocument();
    expect(await screen.findByText("Oil change · Pump 1")).toBeInTheDocument();
    expect(screen.getByText("PM-042")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(urls(fn)).toContain("/api/v1/lookup?type=Procedure");
  });

  it("says a switched-off module is off and sends no list request (US-001 AC-3)", async () => {
    const fn = vi.fn(stubJson({ "/api/v1/org-metadata": metadataFixture({ ROUTINE: { enabled: false, plural: "PM schedules" } }) }));
    vi.stubGlobal("fetch", fn);
    renderWithSession(<ModulePage slug="routines" />, ["ORG_ADMIN"]);
    expect(await screen.findByText("PM schedules is turned off for your organisation.")).toBeInTheDocument();
    expect(urls(fn)).toEqual(["/api/v1/org-metadata"]);
  });

  it("says when there are no items (US-002 AC-3)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(stubJson({ "/api/v1/org-metadata": metadataFixture(), "/api/v1/lookup": { data: [], meta: { total: 0 } } })),
    );
    renderWithSession(<ModulePage slug="inspections" />, ["SUPERVISOR"]);
    expect(await screen.findByText("No inspections yet.")).toBeInTheDocument();
  });

  it("pages tasks with Load more while there is a next cursor (US-002 AC-2)", async () => {
    const task = (id: string) => ({
      id,
      title: `Task ${id}`,
      description: null,
      status: "IN_PROGRESS",
      assignedToName: "Kim",
      dueDate: null,
      assetFullPath: null,
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    });
    const fn = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.startsWith("/api/v1/org-metadata")) return new Response(JSON.stringify(metadataFixture()));
      if (u.includes("after=c1")) return new Response(JSON.stringify({ data: [task("2")], nextCursor: null }));
      if (u.startsWith("/api/v1/activities")) return new Response(JSON.stringify({ data: [task("1")], nextCursor: "c1" }));
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fn);
    renderWithSession(<ModulePage slug="tasks" />, ["ORG_ADMIN"]);
    expect(await screen.findByText("Task 1")).toBeInTheDocument();
    expect(urls(fn)).toContain("/api/v1/activities?limit=50");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Task 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("opens an item with its custom fields, read-only for an Expert (US-005 AC-5)", async () => {
    const f = fieldFixture({ key: "allergen", label: "Allergen" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        stubJson({
          "/api/v1/org-metadata": metadataFixture(),
          "/api/v1/lookup": LOOKUP,
          "/api/v1/content/PROCEDURE/p1/custom-fields": { moduleKey: "PROCEDURE", id: "p1", values: { allergen: "Nuts" }, fields: [f] },
        }),
      ),
    );
    renderWithSession(<ModulePage slug="procedures" />, ["EXPERT"]);
    fireEvent.click(await screen.findByText("Oil change · Pump 1"));
    expect(await screen.findByText("Nuts")).toBeInTheDocument();
    expect(screen.getByText("Allergen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save fields" })).not.toBeInTheDocument();
  });

  it("says an unknown module could not be found", () => {
    const fn = vi.fn(stubJson({}));
    vi.stubGlobal("fetch", fn);
    renderWithSession(<ModulePage slug="nope" />, ["ORG_ADMIN"]);
    expect(screen.getByText("This page could not be found")).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });

  it("is closed to the Super Admin without any request", () => {
    const fn = vi.fn(stubJson({}));
    vi.stubGlobal("fetch", fn);
    renderWithSession(<ModulePage slug="procedures" />, ["SUPER_ADMIN"]);
    expect(screen.getByText("Your role cannot open this page")).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("useOrgMetadata (US-001 AC-4)", () => {
  function Probe() {
    const session = useSession();
    const q = useOrgMetadata(session.user.id, session.roles);
    return <span>{q.fetchStatus}</span>;
  }

  it("never asks for metadata for a Super Admin", async () => {
    const fn = vi.fn(stubJson({}));
    vi.stubGlobal("fetch", fn);
    renderWithSession(<Probe />, ["SUPER_ADMIN"]);
    expect(await screen.findByText("idle")).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("CustomFieldsForm (US-005)", () => {
  const fields = [
    fieldFixture({ key: "qty", label: "Quantity", kind: "NUMBER", required: true }),
    fieldFixture({ key: "note", label: "Note", kind: "TEXT" }),
    fieldFixture({ key: "ok", label: "Line cleared", kind: "BOOLEAN" }),
  ];

  it("sends a number as a number, empty as null and a switch as a boolean", async () => {
    const onSave = vi.fn(async () => undefined);
    renderWithSession(<CustomFieldsForm fields={fields} values={{ note: "old" }} readOnly={false} onSave={onSave} />, ["ORG_ADMIN"]);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "7" } });
    fireEvent.change(screen.getByDisplayValue("old"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Save fields" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ qty: 7, note: null, ok: true }));
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("stops on a missing required field without saving", async () => {
    const onSave = vi.fn(async () => undefined);
    renderWithSession(<CustomFieldsForm fields={fields} values={{}} readOnly={false} onSave={onSave} />, ["ORG_ADMIN"]);
    fireEvent.click(screen.getByRole("button", { name: "Save fields" }));
    expect(await screen.findByText("This field is required.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("ConfigurationPage (SPEC-039 US-003, US-004)", () => {
  it("numbers rows by position and checks names and the last module", () => {
    const rows = metadataFixture().modules.map((m) => ({ key: m.key, enabled: true, order: 99, singular: ` ${m.singular} `, plural: m.plural }));
    const out = modulesPayload(rows);
    expect(out.map((r) => r.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(out[0].singular).toBe("Procedure");
    expect(modulesProblem(rows.map((r) => ({ ...r, enabled: false })))).toBe("Keep at least one module switched on.");
    expect(modulesProblem([{ ...rows[0], plural: " " }])).toMatch(/both names are needed/);
  });

  it("sends every module row with the new name and order (US-003 AC-1)", async () => {
    let meta = metadataFixture();
    const puts: unknown[] = [];
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u === "/api/v1/org-admin/metadata/modules" && init?.method === "PUT") {
        puts.push(JSON.parse(String(init.body)));
        // The server now answers with the saved state, on this call and on the refetch after it.
        meta = metadataFixture({ PROCEDURE: { singular: "SOP", plural: "SOPs", customised: true } });
        return new Response(JSON.stringify(meta));
      }
      if (u.startsWith("/api/v1/org-metadata")) return new Response(JSON.stringify(meta));
      if (u.startsWith("/api/v1/org-admin/metadata/fields")) return new Response(JSON.stringify([]));
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fn);
    renderWithSession(<ConfigurationPage />, ["ORG_ADMIN"]);
    expect(await screen.findByText("General manufacturing")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Procedures, name for many" }), { target: { value: "SOPs" } });
    fireEvent.click(screen.getByRole("button", { name: "Move Procedures down" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    const body = puts[0] as { modules: { key: string; order: number; plural: string }[] };
    expect(body.modules).toHaveLength(10);
    expect(body.modules[0]).toMatchObject({ key: "ROUTINE", order: 1 });
    expect(body.modules[1]).toMatchObject({ key: "PROCEDURE", order: 2, plural: "SOPs" });
    expect(await screen.findByText("Customised")).toBeInTheDocument();
    expect(await screen.findByText("No custom fields for procedures yet.")).toBeInTheDocument();
  });

  it("lists a module's fields with archived ones marked", async () => {
    const fn = vi.fn(
      stubJson({
        "/api/v1/org-metadata": metadataFixture(),
        "/api/v1/org-admin/metadata/fields": [
          fieldFixture({ key: "allergen", label: "Allergen", kind: "CHOICE", options: ["Nuts", "Milk"] }),
          fieldFixture({ key: "old_code", label: "Old code", archivedAt: "2026-11-01T00:00:00Z", order: 2 }),
        ],
      }),
    );
    vi.stubGlobal("fetch", fn);
    renderWithSession(<ConfigurationPage />, ["ORG_ADMIN"]);
    const table = await screen.findByRole("table", { name: "Custom fields" });
    expect(within(table).getByText("Allergen")).toBeInTheDocument();
    expect(within(table).getByText("Choice")).toBeInTheDocument();
    expect(within(table).getByText("Archived")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("is refused to a Manager without calling the API (US-003 AC-5)", () => {
    const fn = vi.fn(stubJson({}));
    vi.stubGlobal("fetch", fn);
    renderWithSession(<ConfigurationPage />, ["MANAGER"]);
    expect(screen.getByText("Your role cannot open this page")).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("MonitoringPage uses the tenant's names (FR-MD-011)", () => {
  it("renames the headings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        stubJson({
          "/api/v1/org-metadata": metadataFixture({ TASK: { plural: "Jobs" }, PROCEDURE: { plural: "SOPs" } }),
          "/api/v1/org-admin/overview": {
            procedures: { draft: 0, pendingApproval: 0, published: 1, archived: 0, publishedLast30d: 0 },
            routines: { active: 0, inactive: 0, inspectionsPublished: 0 },
            tasks: { open: 0, inProgress: 0, submittedForReview: 0, redoRequired: 0, overdue: 0, createdLast30d: 0, completedLast30d: 0 },
            audits: { total: 0, last30d: 0 },
            bdas: { total: 0, last30d: 0 },
            monthly: [],
          },
        }),
      ),
    );
    renderWithSession(<MonitoringPage />, ["ORG_ADMIN"]);
    expect(await screen.findByText("Jobs overdue")).toBeInTheDocument();
    expect(screen.getByText("SOPs published")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument();
  });
});

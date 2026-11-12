import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { Contact, ContactsApi } from "@/lib/api/contacts";
import { renderWithSession } from "@/test/renderWithSession";
import { ContactsEditor } from "../ContactsEditor";

const contact = (id: string, contactType: Contact["contactType"]): Contact => ({
  id,
  name: `Person ${id}`,
  title: null,
  email: `${id}@acme.example`,
  phone: null,
  contactType,
  updatedAt: "2026-11-01T00:00:00Z",
});

function api(overrides: Partial<ContactsApi> = {}): ContactsApi {
  return { create: vi.fn(async () => ({})), update: vi.fn(async () => ({})), remove: vi.fn(async () => ({})), ...overrides };
}

function renderEditor(contacts: Contact[], a: ContactsApi) {
  return renderWithSession(
    <ContactsEditor contacts={contacts} isLoading={false} error={null} onRetry={() => undefined} api={a} />,
    ["ORG_ADMIN"],
  );
}

describe("ContactsEditor (SPEC-038 FR-TAI-010)", () => {
  it("disables Add at 3 contacts and says why", () => {
    renderEditor([contact("a", "PRIMARY"), contact("b", "BILLING"), contact("c", "TECHNICAL")], api());
    expect(screen.getByRole("button", { name: "Add contact" })).toBeDisabled();
    expect(screen.getByText("A company can have at most 3 contacts.")).toBeInTheDocument();
  });

  it("shows the API's 409 as a plain message and keeps the form open", async () => {
    const a = api({ create: vi.fn(async () => Promise.reject(new ApiError(409, "PRIMARY_CONTACT_EXISTS", "x"))) });
    renderEditor([contact("a", "BILLING")], a);
    fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
    fireEvent.change(await screen.findByPlaceholderText("Full name of the contact"), { target: { value: "Jo Rivera" } });
    fireEvent.change(screen.getByPlaceholderText("Work email address"), { target: { value: "jo@acme.example" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/already has a primary contact/)).toBeInTheDocument();
    expect(a.create).toHaveBeenCalledWith({ name: "Jo Rivera", email: "jo@acme.example", contactType: "PRIMARY" });
  });

  it("asks before deleting and then removes the contact", async () => {
    const a = api();
    renderEditor([contact("a", "PRIMARY")], a);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Delete Person a? This cannot be undone.")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(buttons[buttons.length - 1]);
    await vi.waitFor(() => expect(a.remove).toHaveBeenCalledWith("a"));
  });
});

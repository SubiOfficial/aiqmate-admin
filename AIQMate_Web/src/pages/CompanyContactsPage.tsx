// SPEC-038 US-006. The Org Admin keeps their own company's points of contact current.

import { ContactsEditor } from "@/components/ContactsEditor";
import { PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { useOrgContacts, useOrgContactsApi } from "@/lib/api/orgAdmin";
import { useSession } from "@/lib/auth/session";

function CompanyContactsPageContent() {
  const p = usePanelStyles();
  const session = useSession();
  const contacts = useOrgContacts(session.user.id);
  const api = useOrgContactsApi(session.user.id);
  return (
    <div className={p.page}>
      <PageHeader
        title="Company contacts"
        sub="San-Tech, the company behind AiQMate, uses these contacts for account and subscription matters. Keep 2 to 3 people here."
      />
      <ContactsEditor
        contacts={contacts.data}
        isLoading={contacts.isPending}
        error={contacts.isError ? contacts.error : null}
        onRetry={() => void contacts.refetch()}
        api={api}
      />
    </div>
  );
}

/** Gate first, so a role that may not open this page never sends its requests. */
export function CompanyContactsPage() {
  return (
    <RequireRoles roles={["ORG_ADMIN"]}>
      <CompanyContactsPageContent />
    </RequireRoles>
  );
}

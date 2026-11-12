import {
  Card,
  Spinner,
  Text,
} from "@fluentui/react-components";
import { useNavigate } from "@tanstack/react-router";
import { ErrorPanel, PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { DataTable, StatusPill, TenantCell, NumCell, type Column } from "@/components/common";
import { useInvoices, type Invoice } from "@/lib/api/billing";
import { isPlatformRole } from "@/lib/auth/roles";
import { useSession } from "@/lib/auth/session";
import { formatDay, formatUsd } from "@/lib/format";

function formatPeriod(start: string, end: string): string {
  return `${formatDay(start)} to ${formatDay(end)}`;
}

function InvoicesPageContent() {
  const p = usePanelStyles();
  const session = useSession();
  const navigate = useNavigate();
  const isSuperAdmin = isPlatformRole(session.roles);
  const tenantId = isSuperAdmin ? undefined : session.user.orgId;

  const invoices = useInvoices(tenantId);

  const columns: Column<Invoice>[] = [
    { key: "invoice", header: "Invoice", render: (inv) => <Text weight="semibold">{inv.invoiceNumber}</Text> },
    ...(isSuperAdmin
      ? [{ key: "tenant", header: "Tenant", render: (inv: Invoice) => <TenantCell name={inv.tenant?.name ?? "Unknown"} sub={inv.tenant?.orgId ?? inv.tenantId.slice(0, 8)} /> }]
      : []),
    { key: "period", header: "Period", render: (inv) => formatPeriod(inv.billingPeriodStart, inv.billingPeriodEnd) },
    { key: "total", header: "Total", align: "right", render: (inv) => <NumCell>{formatUsd(inv.total)}</NumCell> },
    { key: "paid", header: "Paid", align: "right", render: (inv) => <NumCell>{formatUsd(inv.amountPaid)}</NumCell> },
    { key: "outstanding", header: "Outstanding", align: "right", render: (inv) => <NumCell>{formatUsd(inv.outstandingBalance)}</NumCell> },
    { key: "status", header: "Status", render: (inv) => <StatusPill status={inv.status} /> },
    { key: "due", header: "Due", render: (inv) => formatDay(inv.dueDate) },
  ];

  return (
    <div className={p.page}>
      <PageHeader
        title="Invoices"
        sub={isSuperAdmin ? "All invoices across tenants." : "Your invoices and billing history."}
      />

      {invoices.isPending ? (
        <Spinner label="Loading invoices..." />
      ) : invoices.isError ? (
        <ErrorPanel error={invoices.error} onRetry={() => void invoices.refetch()} />
      ) : !invoices.data || invoices.data.items.length === 0 ? (
        <Card className={p.card}>
          <Text className={p.empty}>No invoices yet.</Text>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={invoices.data.items}
          rowKey={(inv) => inv.id}
          onRowClick={(inv) => void navigate({ to: "/invoices/$invoiceId", params: { invoiceId: inv.id } })}
          emptyMessage="No invoices yet."
        />
      )}
    </div>
  );
}

export function InvoicesPage() {
  return (
    <RequireRoles roles={["SUPER_ADMIN", "ORG_ADMIN"]}>
      <InvoicesPageContent />
    </RequireRoles>
  );
}

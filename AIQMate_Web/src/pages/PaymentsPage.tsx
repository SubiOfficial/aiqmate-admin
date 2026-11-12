import {
  Spinner,
  tokens,
} from "@fluentui/react-components";
import { ErrorPanel, PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { DataTable, StatusPill, TenantCell, NumCell, type Column } from "@/components/common";
import { usePayments, type PaymentRecord } from "@/lib/api/billing";
import { isPlatformRole } from "@/lib/auth/roles";
import { useSession } from "@/lib/auth/session";
import { formatDay, formatUsd } from "@/lib/format";

function PaymentsPageContent() {
  const p = usePanelStyles();
  const session = useSession();
  const isSuperAdmin = isPlatformRole(session.roles);
  const tenantId = isSuperAdmin ? undefined : session.user.orgId;

  const payments = usePayments(tenantId);

  const columns: Column<PaymentRecord>[] = [
    { key: "date", header: "Date", render: (pay) => formatDay(pay.paidAt ?? pay.createdAt) },
    ...(isSuperAdmin
      ? [{
          key: "tenant",
          header: "Tenant",
          render: (pay: PaymentRecord) => (
            <TenantCell name={pay.tenant?.name ?? "Unknown"} sub={pay.tenant?.orgId ?? pay.tenantId.slice(0, 8)} />
          ),
        }]
      : []),
    { key: "invoice", header: "Invoice", render: (pay) => pay.invoiceNumber ?? "N/A" },
    { key: "amount", header: "Amount", align: "right" as const, render: (pay) => <NumCell>{formatUsd(pay.amount)}</NumCell> },
    { key: "method", header: "Method", render: (pay) => pay.paymentMethod ?? "Not specified" },
    { key: "status", header: "Status", render: (pay) => <StatusPill status={pay.status} /> },
    {
      key: "txn",
      header: "Transaction ID",
      render: (pay) => (
        <span style={{ fontFamily: "var(--fontFamilyMonospace, monospace)", fontSize: tokens.fontSizeBase200 }}>
          {pay.transactionId ?? "N/A"}
        </span>
      ),
    },
  ];

  return (
    <div className={p.page}>
      <PageHeader
        title="Payments"
        sub={isSuperAdmin ? "All payment records across tenants." : "Your payment history."}
      />

      {payments.isPending ? (
        <Spinner label="Loading payments..." />
      ) : payments.isError ? (
        <ErrorPanel error={payments.error} onRetry={() => void payments.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={payments.data?.items ?? []}
          rowKey={(pay) => pay.id}
          emptyMessage="No payment records yet."
        />
      )}
    </div>
  );
}

export function PaymentsPage() {
  return (
    <RequireRoles roles={["SUPER_ADMIN", "ORG_ADMIN"]}>
      <PaymentsPageContent />
    </RequireRoles>
  );
}

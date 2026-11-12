import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  tokens,
  type BadgeProps,
} from "@fluentui/react-components";
import { useState } from "react";
import { ErrorPanel, PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { useInvoice, useVoidInvoice, useRecordPayment, type Invoice } from "@/lib/api/billing";
import { isPlatformRole } from "@/lib/auth/roles";
import { useSession } from "@/lib/auth/session";
import { formatDay, formatUsd } from "@/lib/format";

const useStyles = makeStyles({
  summary: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: tokens.spacingVerticalS,
    "@media (min-width: 768px)": { gridTemplateColumns: "1fr 1fr 1fr 1fr" },
  },
  label: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  value: { fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: "tabular-nums" },
  num: { fontVariantNumeric: "tabular-nums", textAlign: "right" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  sections: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
});

const STATUS_COLOR: Record<string, BadgeProps["color"]> = {
  DRAFT: "informative",
  OPEN: "brand",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "informative",
};

function SummaryField({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <div>
      <Text className={s.label}>{label}</Text>
      <br />
      <Text className={s.value}>{value}</Text>
    </div>
  );
}

function PaymentDialog({ invoice, open, onClose }: { invoice: Invoice; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState(invoice.outstandingBalance);
  const [method, setMethod] = useState("");
  const record = useRecordPayment();

  const handleSubmit = async () => {
    await record.mutateAsync({ invoiceId: invoice.id, amount, paymentMethod: method || undefined });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Record payment for {invoice.invoiceNumber}</DialogTitle>
          <DialogContent>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "8px" }}>
              <div>
                <Text size={200} weight="semibold">Amount</Text>
                <Input value={amount} onChange={(_, d) => setAmount(d.value)} type="number" style={{ width: "100%" }} />
              </div>
              <div>
                <Text size={200} weight="semibold">Payment method</Text>
                <Input value={method} onChange={(_, d) => setMethod(d.value)} placeholder="Bank Transfer, Credit Card, etc." style={{ width: "100%" }} />
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>Cancel</Button>
            <Button appearance="primary" onClick={() => void handleSubmit()} disabled={record.isPending}>
              {record.isPending ? "Recording..." : "Record payment"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function InvoiceDetailContent({ invoiceId }: { invoiceId: string }) {
  const p = usePanelStyles();
  const st = useStyles();
  const session = useSession();
  const isSuperAdmin = isPlatformRole(session.roles);
  const invoiceQuery = useInvoice(invoiceId);
  const voidInvoice = useVoidInvoice();
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (invoiceQuery.isPending) return <Spinner label="Loading invoice..." />;
  if (invoiceQuery.isError) return <ErrorPanel error={invoiceQuery.error} onRetry={() => void invoiceQuery.refetch()} />;

  const inv = invoiceQuery.data;
  if (!inv) return <Text>Invoice not found.</Text>;

  const canVoid = isSuperAdmin && (inv.status === "OPEN" || inv.status === "OVERDUE");
  const canPay = inv.status === "OPEN" || inv.status === "PARTIALLY_PAID" || inv.status === "OVERDUE";

  return (
    <div className={p.page}>
      <PageHeader
        title={inv.invoiceNumber}
        sub={`${inv.tenant?.name ?? "Tenant"} - ${formatDay(inv.billingPeriodStart)} to ${formatDay(inv.billingPeriodEnd)}`}
        aside={
          <Badge appearance="tint" color={STATUS_COLOR[inv.status] ?? "informative"} size="large">
            {inv.status.replace(/_/g, " ")}
          </Badge>
        }
      />

      <div className={st.sections}>
        <Card className={p.card}>
          <Text as="h2" size={500} weight="semibold">Summary</Text>
          <div className={st.summary}>
            <SummaryField label="Currency" value={inv.currency} />
            <SummaryField label="Subtotal" value={formatUsd(inv.subtotal)} />
            <SummaryField label="Tax" value={formatUsd(inv.taxAmount)} />
            <SummaryField label="Discount" value={formatUsd(inv.discountAmount)} />
            <SummaryField label="Total" value={formatUsd(inv.total)} />
            <SummaryField label="Paid" value={formatUsd(inv.amountPaid)} />
            <SummaryField label="Outstanding" value={formatUsd(inv.outstandingBalance)} />
            <SummaryField label="Due date" value={formatDay(inv.dueDate)} />
          </div>
        </Card>

        {inv.items && inv.items.length > 0 && (
          <Card className={p.card}>
            <Text as="h2" size={500} weight="semibold">Line items</Text>
            <div className={p.scroll}>
              <Table aria-label="Invoice items" size="small" className={p.table}>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Description</TableHeaderCell>
                    <TableHeaderCell>Tier</TableHeaderCell>
                    <TableHeaderCell>Quantity</TableHeaderCell>
                    <TableHeaderCell>Rate</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>
                        {item.tierMin != null ? `${item.tierMin}${item.tierMax != null ? ` - ${item.tierMax}` : "+"}` : "All"}
                      </TableCell>
                      <TableCell className={st.num}>{item.quantity}</TableCell>
                      <TableCell className={st.num}>{formatUsd(item.unitRate)}</TableCell>
                      <TableCell className={st.num}>{formatUsd(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {inv.payments && inv.payments.length > 0 && (
          <Card className={p.card}>
            <Text as="h2" size={500} weight="semibold">Payment history</Text>
            <div className={p.scroll}>
              <Table aria-label="Payments" size="small" className={p.table}>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Method</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.payments.map((pay) => (
                    <TableRow key={pay.id}>
                      <TableCell>{formatDay(pay.paidAt ?? pay.createdAt)}</TableCell>
                      <TableCell className={st.num}>{formatUsd(pay.amount)}</TableCell>
                      <TableCell>{pay.paymentMethod ?? "Not specified"}</TableCell>
                      <TableCell>
                        <Badge appearance="tint" color={pay.status === "PAID" ? "success" : pay.status === "FAILED" ? "danger" : "informative"}>
                          {pay.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        <div className={st.actions}>
          {canPay && (
            <Button appearance="primary" onClick={() => setPaymentOpen(true)}>Record payment</Button>
          )}
          {canVoid && (
            <Button
              appearance="secondary"
              onClick={() => void voidInvoice.mutateAsync(inv.id).then(() => void invoiceQuery.refetch())}
              disabled={voidInvoice.isPending}
            >
              {voidInvoice.isPending ? "Voiding..." : "Void invoice"}
            </Button>
          )}
        </div>
      </div>

      {paymentOpen && <PaymentDialog invoice={inv} open={paymentOpen} onClose={() => { setPaymentOpen(false); void invoiceQuery.refetch(); }} />}
    </div>
  );
}

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  return (
    <RequireRoles roles={["SUPER_ADMIN", "ORG_ADMIN"]}>
      <InvoiceDetailContent invoiceId={invoiceId} />
    </RequireRoles>
  );
}

// SPEC-038 US-001. Every customer organisation at a glance, for the Super Admin.

import {
  Badge,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
  type BadgeProps,
} from "@fluentui/react-components";
import { ErrorPanel, LoadingTiles, PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { TextLink } from "@/components/TextLink";
import { DataTable, StatusPill, HealthPill, ContactCell, NumCell, type Column } from "@/components/common";
import { healthReasonLabel, useTenants, type SubscriptionStatus, type TenantSummary } from "@/lib/api/platform";
import { useSession } from "@/lib/auth/session";
import { formatCount, formatDay } from "@/lib/format";

const useStyles = makeStyles({
  reasons: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  stacked: { flexDirection: "column", alignItems: "flex-start" },
  wrap: { overflowWrap: "anywhere" },
  muted: { color: tokens.colorNeutralForeground3 },
});

export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = { TRIAL: "Trial", ACTIVE: "Active", EXPIRED: "Expired" };
const SUBSCRIPTION_COLOR: Record<SubscriptionStatus, BadgeProps["color"]> = {
  TRIAL: "warning",
  ACTIVE: "success",
  EXPIRED: "danger",
};

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const p = usePanelStyles();
  return (
    <Badge className={p.nowrap} appearance="tint" color={SUBSCRIPTION_COLOR[status] ?? "informative"}>
      {SUBSCRIPTION_LABEL[status] ?? status}
    </Badge>
  );
}

export function HealthBadges({ tenant, stacked = false }: { tenant: Pick<TenantSummary, "health" | "reasons">; stacked?: boolean }) {
  const s = useStyles();
  const p = usePanelStyles();
  if (tenant.health === "OK" || tenant.reasons.length === 0) {
    return (
      <Badge className={p.nowrap} appearance="tint" color="success">
        Healthy
      </Badge>
    );
  }
  return (
    <span className={mergeClasses(s.reasons, stacked && s.stacked)}>
      {tenant.reasons.map((r) => (
        <Badge key={r} className={p.nowrap} appearance="tint" color="warning">
          {healthReasonLabel(r)}
        </Badge>
      ))}
    </span>
  );
}

const tenantsColumns: Column<TenantSummary>[] = [
  {
    key: "org",
    header: "Organisation",
    render: (t) => (
      <TextLink to="/tenants/$orgId" params={{ orgId: t.orgId }}>
        {t.name}
      </TextLink>
    ),
  },
  {
    key: "sub",
    header: "Subscription",
    render: (t) => <StatusPill status={t.subscription.status} />,
  },
  {
    key: "trial",
    header: "Trial ends",
    render: (t) => <>{t.subscription.trialEndsAt ? formatDay(t.subscription.trialEndsAt) : "No trial"}</>,
  },
  {
    key: "seats",
    header: "Seats",
    align: "right",
    render: (t) => <NumCell>{formatCount(t.seats.used)} of {formatCount(t.seats.limit)}</NumCell>,
  },
  {
    key: "contact",
    header: "Primary contact",
    render: (t) =>
      t.primaryContact ? (
        <ContactCell name={t.primaryContact.name} email={t.primaryContact.email} />
      ) : (
        <Text style={{ color: tokens.colorNeutralForeground3 }}>No primary contact</Text>
      ),
  },
  {
    key: "signedIn",
    header: "Signed in, 30 days",
    align: "right",
    render: (t) => <NumCell>{formatCount(t.activeUsers30d)}</NumCell>,
  },
  {
    key: "lastActivity",
    header: "Last activity",
    render: (t) => <>{t.lastActivityAt ? formatDay(t.lastActivityAt) : "No activity yet"}</>,
  },
  {
    key: "health",
    header: "Health",
    render: (t) => <HealthPill health={t.health} />,
  },
];

export function TenantsTable({ items }: { items: TenantSummary[] }) {
  if (items.length === 0) {
    return <Text style={{ padding: "24px", textAlign: "center", color: tokens.colorNeutralForeground3 }}>No customer organisations yet.</Text>;
  }
  return (
    <DataTable<TenantSummary>
      columns={tenantsColumns}
      data={items}
      rowKey={(t) => t.orgId}
      emptyMessage="No customer organisations yet."
    />
  );
}

function TenantsPageContent() {
  const p = usePanelStyles();
  const session = useSession();
  const tenants = useTenants(session.user.id);
  return (
    <div className={p.page}>
      <PageHeader title="Tenants" sub="Customer organisations: subscription, seats, contacts and usage." />
      {tenants.isError ? (
        <ErrorPanel error={tenants.error} onRetry={() => void tenants.refetch()} />
      ) : tenants.data ? (
        <TenantsTable items={tenants.data} />
      ) : (
        <LoadingTiles count={2} />
      )}
    </div>
  );
}

/** Gate first, so a role that may not open this page never sends its requests. */
export function TenantsPage() {
  return (
    <RequireRoles roles={["SUPER_ADMIN"]}>
      <TenantsPageContent />
    </RequireRoles>
  );
}

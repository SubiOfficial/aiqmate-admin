import {
  Badge,
  Card,
  Spinner,
  Text,
  makeStyles,
  tokens,
  type BadgeProps,
} from "@fluentui/react-components";
import { ErrorPanel, PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { useSubscription, type SubscriptionInfo } from "@/lib/api/billing";
import { isPlatformRole } from "@/lib/auth/roles";
import { useSession } from "@/lib/auth/session";
import { formatDay, formatUsd, humanizeEnum } from "@/lib/format";

const useStyles = makeStyles({
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: tokens.spacingVerticalL,
    "@media (min-width: 768px)": { gridTemplateColumns: "1fr 1fr" },
  },
  fields: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
  },
  label: { color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase200 },
  value: { textAlign: "right", fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase200, fontVariantNumeric: "tabular-nums" },
});

const STATUS_COLOR: Record<string, BadgeProps["color"]> = {
  TRIAL: "warning",
  ACTIVE: "success",
  EXPIRED: "danger",
  CANCELLED: "informative",
  SUSPENDED: "danger",
};

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const s = useStyles();
  const display = value != null && value !== "" ? String(value) : "Not set";
  return (
    <>
      <Text className={s.label}>{label}</Text>
      <Text className={s.value}>{display}</Text>
    </>
  );
}

function SubDetail({ sub }: { sub: SubscriptionInfo }) {
  const s = useStyles();
  const p = usePanelStyles();
  return (
    <div className={s.grid}>
      <Card className={p.card}>
        <Text as="h2" size={500} weight="semibold">Plan details</Text>
        <div className={s.fields}>
          <Field label="Plan" value={sub.plan} />
          <Field label="Status" value={humanizeEnum(sub.status)} />
          <Field label="Subscription model" value={humanizeEnum(sub.subscriptionModel)} />
          <Field label="Billing cycle" value={humanizeEnum(sub.billingCycle)} />
          <Field label="Monthly rate" value={formatUsd(sub.monthlyRate)} />
          <Field label="Currency" value={sub.currency} />
          {sub.includedAllowance != null && <Field label="Included allowance" value={`${sub.includedAllowance} procedures`} />}
        </div>
      </Card>

      <Card className={p.card}>
        <Text as="h2" size={500} weight="semibold">Dates</Text>
        <div className={s.fields}>
          <Field label="Start date" value={formatDay(sub.startDate)} />
          <Field label="End date" value={sub.endDate ? formatDay(sub.endDate) : "Ongoing"} />
          {sub.trialEndsAt && <Field label="Trial ends" value={formatDay(sub.trialEndsAt)} />}
          {sub.renewalDate && <Field label="Next renewal" value={formatDay(sub.renewalDate)} />}
          <Field label="Auto-renew" value={sub.autoRenew ? "Yes" : "No"} />
          {sub.cancelledAt && <Field label="Cancelled" value={formatDay(sub.cancelledAt)} />}
          {sub.cancellationReason && <Field label="Cancellation reason" value={sub.cancellationReason} />}
        </div>
      </Card>
    </div>
  );
}

function SubscriptionPageContent() {
  const p = usePanelStyles();
  const session = useSession();
  const isSuperAdmin = isPlatformRole(session.roles);
  const sub = useSubscription(isSuperAdmin ? undefined : session.user.orgId);

  return (
    <div className={p.page}>
      <PageHeader
        title="Subscription"
        sub="Current plan, billing cycle and renewal information."
        aside={
          sub.data ? (
            <Badge appearance="tint" color={STATUS_COLOR[sub.data.status] ?? "informative"} size="large">
              {humanizeEnum(sub.data.status)}
            </Badge>
          ) : undefined
        }
      />

      {sub.isPending ? (
        <Spinner label="Loading subscription..." />
      ) : sub.isError ? (
        <ErrorPanel error={sub.error} onRetry={() => void sub.refetch()} />
      ) : sub.data ? (
        <SubDetail sub={sub.data} />
      ) : (
        <Card className={p.card}>
          <Text className={p.empty}>No subscription found for this tenant.</Text>
        </Card>
      )}
    </div>
  );
}

export function SubscriptionPage() {
  return (
    <RequireRoles roles={["SUPER_ADMIN", "ORG_ADMIN"]}>
      <SubscriptionPageContent />
    </RequireRoles>
  );
}

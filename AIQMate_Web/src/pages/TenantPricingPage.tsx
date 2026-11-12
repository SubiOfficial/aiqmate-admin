import {
  Badge,
  Card,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ErrorPanel, PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { useTenantPricingView, type PricingConfig } from "@/lib/api/pricing";
import { useSession } from "@/lib/auth/session";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalS },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  meta: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
  tierGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    fontVariantNumeric: "tabular-nums",
    padding: `${tokens.spacingVerticalXXS} 0`,
  },
  tierHeader: { fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground2 },
  empty: { padding: tokens.spacingHorizontalXXL, textAlign: "center", color: tokens.colorNeutralForeground3 },
  info: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
});

function ConfigCard({ config }: { config: PricingConfig }) {
  const s = useStyles();
  return (
    <Card className={s.card}>
      <div className={s.header}>
        <Text weight="semibold">
          {config.pricingModel === "GRADUATED" ? "Graduated" : "Volume"} pricing
          {config.category ? ` for ${config.category.displayName}` : ""}
        </Text>
        <Badge appearance="filled" color="success">Active</Badge>
      </div>

      <div className={s.meta}>
        <span>{config.currency}</span>
        <span>{config.billingPeriod}</span>
      </div>

      <Text className={s.info}>
        {config.pricingModel === "GRADUATED"
          ? "Each tier's rate applies only to procedures within that range."
          : "The tier that contains your total usage determines the rate for all procedures."}
      </Text>

      {config.tiers.length > 0 && (
        <div>
          <div className={`${s.tierGrid} ${s.tierHeader}`}>
            <span>Procedure range</span>
            <span>Rate per procedure</span>
            <span>Tier</span>
          </div>
          {config.tiers.map((tier, i) => (
            <div key={i} className={s.tierGrid}>
              <span>{tier.minimumQuantity} - {tier.maximumQuantity ?? "and above"}</span>
              <span>{config.currency} {tier.unitRate}</span>
              <span>Tier {tier.tierOrder}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TenantPricingPageContent() {
  const s = useStyles();
  const p = usePanelStyles();
  const session = useSession();
  const pricingQuery = useTenantPricingView(session.user.id);

  return (
    <div className={p.page}>
      <PageHeader title="Procedure Pricing" sub="Your current pricing configuration and billing rates." />

      {pricingQuery.isPending && <Spinner label="Loading pricing..." />}
      {pricingQuery.isError && <ErrorPanel error={pricingQuery.error} onRetry={() => void pricingQuery.refetch()} />}

      {pricingQuery.data && (
        <div className={s.list}>
          {pricingQuery.data.length === 0 ? (
            <Card className={s.empty}>
              <Text>No pricing has been configured for your organisation yet. Contact your account manager for details.</Text>
            </Card>
          ) : (
            pricingQuery.data.map((config) => (
              <ConfigCard key={config.id} config={config} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function TenantPricingPage() {
  return (
    <RequireRoles roles={["ORG_ADMIN", "MANAGER", "SUPERVISOR", "EXPERT"]}>
      <TenantPricingPageContent />
    </RequireRoles>
  );
}

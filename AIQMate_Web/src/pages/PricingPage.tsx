import {
  Badge,
  Button,
  Card,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Add24Regular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { ErrorPanel, PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { PricingEditor } from "@/components/pricing/PricingEditor";
import {
  useActivateConfig,
  useDeactivateConfig,
  usePricingConfigs,
  type PricingConfig,
} from "@/lib/api/pricing";
import { useTenant } from "@/lib/api/platform";
import { useSession } from "@/lib/auth/session";
import { formatMoment } from "@/lib/format";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  configCard: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalS },
  configHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  configMeta: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
  tierList: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, marginTop: tokens.spacingVerticalS },
  tierRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    fontVariantNumeric: "tabular-nums",
    padding: `${tokens.spacingVerticalXXS} 0`,
  },
  tierHeader: { fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground2 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalS },
  empty: { padding: tokens.spacingHorizontalXXL, textAlign: "center", color: tokens.colorNeutralForeground3 },
});

function statusColor(status: string): "brand" | "success" | "warning" | "informative" | "danger" {
  switch (status) {
    case "ACTIVE": return "success";
    case "DRAFT": return "informative";
    case "SCHEDULED": return "warning";
    case "INACTIVE": return "danger";
    default: return "informative";
  }
}

function ConfigRow({ config, onEdit }: { config: PricingConfig; onEdit: (c: PricingConfig) => void }) {
  const s = useStyles();
  const activate = useActivateConfig();
  const deactivate = useDeactivateConfig();

  return (
    <Card className={s.configCard}>
      <div className={s.configHeader}>
        <div>
          <Text weight="semibold">{config.pricingModel === "GRADUATED" ? "Graduated" : "Volume"} pricing</Text>
          {config.category && <Text size={200}> for {config.category.displayName}</Text>}
        </div>
        <Badge appearance="filled" color={statusColor(config.status)}>{config.status}</Badge>
      </div>
      <div className={s.configMeta}>
        <span>{config.currency}</span>
        <span>{config.billingPeriod}</span>
        <span>From {formatMoment(config.effectiveFrom)}</span>
        {config.effectiveTo && <span>To {formatMoment(config.effectiveTo)}</span>}
        <span>v{config.version}</span>
      </div>
      {config.tiers.length > 0 && (
        <div className={s.tierList}>
          <div className={`${s.tierRow} ${s.tierHeader}`}>
            <span>Range</span>
            <span>Rate per unit</span>
            <span>Tier</span>
          </div>
          {config.tiers.map((tier, i) => (
            <div key={i} className={s.tierRow}>
              <span>{tier.minimumQuantity} - {tier.maximumQuantity ?? "unlimited"}</span>
              <span>{config.currency} {tier.unitRate}</span>
              <span>Tier {tier.tierOrder}</span>
            </div>
          ))}
        </div>
      )}
      <div className={s.actions}>
        {(config.status === "DRAFT" || config.status === "SCHEDULED") && (
          <Button size="small" onClick={() => onEdit(config)}>Edit</Button>
        )}
        {config.status === "DRAFT" && (
          <Button size="small" appearance="primary" onClick={() => activate.mutate(config.id)} disabled={activate.isPending}>
            Activate
          </Button>
        )}
        {config.status === "ACTIVE" && (
          <Button size="small" onClick={() => deactivate.mutate(config.id)} disabled={deactivate.isPending}>
            Deactivate
          </Button>
        )}
      </div>
    </Card>
  );
}

function PricingPageContent({ tenantOrgId }: { tenantOrgId: string }) {
  const s = useStyles();
  const p = usePanelStyles();
  const session = useSession();
  const tenantQuery = useTenant(session.user.id, tenantOrgId);
  const [editing, setEditing] = useState<PricingConfig | null | "new">(null);
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);

  const tenantName = tenantQuery.data?.tenant?.name ?? tenantOrgId;

  useEffect(() => {
    if (tenantQuery.data?.tenant) {
      setResolvedTenantId(tenantOrgId);
    }
  }, [tenantQuery.data, tenantOrgId]);

  const configsQuery = usePricingConfigs(resolvedTenantId);

  if (tenantQuery.isPending) return <Spinner label="Loading tenant..." />;
  if (tenantQuery.isError) return <ErrorPanel error={tenantQuery.error} onRetry={() => void tenantQuery.refetch()} />;

  if (editing === "new" && resolvedTenantId) {
    return (
      <div className={p.page}>
        <PricingEditor tenantId={resolvedTenantId} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />
      </div>
    );
  }

  if (editing && editing !== "new" && resolvedTenantId) {
    return (
      <div className={p.page}>
        <PricingEditor tenantId={resolvedTenantId} existing={editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div className={p.page}>
      <PageHeader
        title="Procedure Pricing"
        sub={`Pricing configuration for ${tenantName}`}
        aside={
          <Button appearance="primary" icon={<Add24Regular />} onClick={() => setEditing("new")}>
            New configuration
          </Button>
        }
      />

      {configsQuery.isPending && <Spinner label="Loading pricing configurations..." />}
      {configsQuery.isError && <ErrorPanel error={configsQuery.error} onRetry={() => void configsQuery.refetch()} />}

      {configsQuery.data && (
        <div className={s.list}>
          {configsQuery.data.length === 0 ? (
            <Card className={s.empty}>
              <Text>No pricing configurations yet. Create one to start billing this tenant.</Text>
            </Card>
          ) : (
            configsQuery.data.map((config) => (
              <ConfigRow key={config.id} config={config} onEdit={(c) => setEditing(c)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function PricingPage({ tenantOrgId }: { tenantOrgId: string }) {
  return (
    <RequireRoles roles={["SUPER_ADMIN"]}>
      <PricingPageContent tenantOrgId={tenantOrgId} />
    </RequireRoles>
  );
}

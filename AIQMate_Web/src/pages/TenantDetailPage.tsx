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
  DialogTrigger,
  Field,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  ProgressBar,
  Skeleton,
  SkeletonItem,
  Tab,
  TabList,
  Text,
  Textarea,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import type { SelectTabData, SelectTabEvent } from "@fluentui/react-components";
import {
  Edit24Regular,
  MoreVertical24Regular,
  ArrowClockwise24Regular,
  CalendarAdd24Regular,
  Dismiss24Regular,
  Play24Regular,
  Search24Regular,
} from "@fluentui/react-icons";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ErrorPanel, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { TextLink } from "@/components/TextLink";
import { DataTable, StatusPill, NumCell, type Column } from "@/components/common";
import {
  useTenantFull,
  useTenantIdByOrg,
  useUpdateTenant,
  useSubscriptionAction,
  type TenantFullDetail,
  type TenantPricingConfig,
  type TenantPricingTier,
  type TenantInvoiceSummary,
  type TenantPaymentRecord,
  type AdditionalCharges,
  type UsageByCategory,
} from "@/lib/api/tenantAdmin";

type TabKey = "overview" | "usage" | "pricing" | "billing" | "payments" | "subscription" | "history";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  badges: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "1fr",
    "@media (min-width: 480px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    "@media (min-width: 960px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
  },
  tile: {
    padding: tokens.spacingHorizontalL,
    gap: tokens.spacingVerticalXXS,
    minHeight: "88px",
  },
  tileLabel: { color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase200 },
  tileValue: { fontSize: "1.5rem", fontWeight: tokens.fontWeightBold, fontVariantNumeric: "tabular-nums" },
  tileHint: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100, marginTop: "auto" },
  tileAccentGreen: { borderLeft: `4px solid ${tokens.colorPaletteGreenBorder2}` },
  tileAccentBlue: { borderLeft: `4px solid ${tokens.colorBrandStroke1}` },
  tileAccentOrange: { borderLeft: `4px solid ${tokens.colorPaletteMarigoldBorderActive}` },
  tileAccentRed: { borderLeft: `4px solid ${tokens.colorPaletteRedBorderActive}` },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  cardTitle: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  dl: { display: "grid", gridTemplateColumns: "minmax(0, 180px) minmax(0, 1fr)", columnGap: tokens.spacingHorizontalL, rowGap: tokens.spacingVerticalS, margin: 0, fontSize: tokens.fontSizeBase200 },
  dt: { color: tokens.colorNeutralForeground2 },
  dd: { margin: 0, overflowWrap: "anywhere", fontWeight: tokens.fontWeightSemibold },
  timeline: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  timelineItem: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: tokens.fontSizeBase200,
  },
  timelineAction: { fontWeight: tokens.fontWeightSemibold },
  timelineDate: { color: tokens.colorNeutralForeground3, whiteSpace: "nowrap" },
  timelineMeta: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100 },
  progressWrap: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, marginTop: tokens.spacingVerticalS },
  progressLabel: { display: "flex", justifyContent: "space-between", fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  loading: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, padding: tokens.spacingVerticalL },
  twoCol: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "1fr",
    "@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  },
  threeCol: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "1fr",
    "@media (min-width: 768px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
  },
  filterRow: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center" },
  searchInput: { minWidth: "200px" },
  changeValues: { display: "flex", gap: tokens.spacingHorizontalS, fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXXS },
  oldValue: { textDecoration: "line-through", color: tokens.colorPaletteRedForeground1 },
  newValue: { color: tokens.colorPaletteGreenForeground1 },
  explanationBox: {
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  usageBarWrap: { marginTop: tokens.spacingVerticalM },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: string): "success" | "danger" | "warning" | "informative" | "brand" {
  const s = status.toUpperCase();
  if (["ACTIVE", "PAID", "COMPLETED"].includes(s)) return "success";
  if (["EXPIRED", "FAILED", "OVERDUE", "CANCELLED", "SUSPENDED"].includes(s)) return "danger";
  if (["EXPIRING_SOON", "PENDING", "PARTIALLY_PAID"].includes(s)) return "warning";
  if (["TRIAL", "DRAFT", "SCHEDULED"].includes(s)) return "informative";
  return "brand";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtMoney(amount: string | number, currency = "USD"): string {
  return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Tile({ label, value, hint, accent = "blue" }: { label: string; value: string | number; hint?: string; accent?: "blue" | "green" | "orange" | "red" }) {
  const s = useStyles();
  const accentClass = accent === "green" ? s.tileAccentGreen : accent === "orange" ? s.tileAccentOrange : accent === "red" ? s.tileAccentRed : s.tileAccentBlue;
  return (
    <Card className={mergeClasses(s.tile, accentClass)}>
      <Text className={s.tileLabel}>{label}</Text>
      <Text className={s.tileValue}>{typeof value === "number" ? value.toLocaleString() : value}</Text>
      {hint && <Text className={s.tileHint}>{hint}</Text>}
    </Card>
  );
}

function usageBarColor(pct: number): "brand" | "success" | "warning" | "error" {
  if (pct >= 100) return "error";
  if (pct >= 90) return "warning";
  if (pct >= 75) return "warning";
  return "success";
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Expiry countdown banner
// ---------------------------------------------------------------------------

function ExpiryCountdown({ endDate }: { endDate: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const end = new Date(endDate).getTime();
  const diff = Math.max(0, end - now);
  const days = Math.floor(diff / 86_400_000);
  const hrs = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const endFormatted = new Date(endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="td-expiry-banner">
      <div className="td-expiry-banner__left">
        <span className="td-expiry-banner__icon">⚠</span>
        <span>Subscription expires on <strong>{endFormatted}</strong></span>
      </div>
      <div className="td-expiry-banner__timer">
        <div className="td-expiry-banner__unit"><span className="td-expiry-banner__num">{days}</span><span className="td-expiry-banner__label">days</span></div>
        <span className="td-expiry-banner__sep">:</span>
        <div className="td-expiry-banner__unit"><span className="td-expiry-banner__num">{pad(hrs)}</span><span className="td-expiry-banner__label">hrs</span></div>
        <span className="td-expiry-banner__sep">:</span>
        <div className="td-expiry-banner__unit"><span className="td-expiry-banner__num">{pad(mins)}</span><span className="td-expiry-banner__label">min</span></div>
        <span className="td-expiry-banner__sep">:</span>
        <div className="td-expiry-banner__unit"><span className="td-expiry-banner__num">{pad(secs)}</span><span className="td-expiry-banner__label">sec</span></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Overview (Layout A1)
// ---------------------------------------------------------------------------

function barFillClass(pct: number): string {
  if (pct >= 90) return "td-usage-bar__fill td-usage-bar__fill--bad";
  if (pct >= 75) return "td-usage-bar__fill td-usage-bar__fill--warn";
  return "td-usage-bar__fill";
}

function OverviewTab({ data, onTabSwitch }: { data: TenantFullDetail; onTabSwitch: (tab: TabKey) => void }) {
  const o = data.overview;
  const sub = data.subscription;
  const u = data.usage;
  const seatPct = o.seatLimit > 0 ? Math.round((o.seatsUsed / o.seatLimit) * 100) : 0;
  const procPct = u.includedAllowance != null && u.includedAllowance > 0 ? Math.round((u.billable / u.includedAllowance) * 100) : 0;
  const subElapsed = sub ? (sub.totalDays > 0 ? Math.round(((sub.totalDays - (sub.remainingDays ?? 0)) / sub.totalDays) * 100) : 0) : 0;

  const addressParts = [o.address, [o.city, o.state].filter(Boolean).join(", "), o.postalCode, o.country].filter(Boolean);

  return (
    <div className="td-overview">
      {/* LEFT COLUMN */}
      <div className="td-overview__left">
        {/* Usage & capacity */}
        <div className="td-card">
          <div className="td-card__head">
            <span className="td-card__title">Usage &amp; capacity</span>
            <button className="td-card__link" onClick={() => onTabSwitch("usage")}>View usage</button>
          </div>
          <div className="td-card__body" style={{ padding: 0 }}>
            <table className="td-usage-tbl" style={{ padding: "0 20px" }}>
              <thead>
                <tr><th style={{ paddingLeft: 20 }}>Metric</th><th>Value</th><th>Utilisation</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ paddingLeft: 20 }}>Seats</td>
                  <td>{o.seatsUsed} / {o.seatLimit}</td>
                  <td>
                    <div className="td-usage-bar">
                      <div className="td-usage-bar__track"><div className={barFillClass(seatPct)} style={{ width: `${Math.min(100, seatPct)}%` }} /></div>
                      <span className="td-usage-bar__pct">{seatPct}%</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 20 }}>Included procedures</td>
                  <td>{u.billable} / {u.includedAllowance ?? "∞"}</td>
                  <td>
                    {u.includedAllowance != null ? (
                      <div className="td-usage-bar">
                        <div className="td-usage-bar__track"><div className={barFillClass(procPct)} style={{ width: `${Math.min(100, procPct)}%` }} /></div>
                        <span className="td-usage-bar__pct">{procPct}%</span>
                      </div>
                    ) : <span style={{ fontSize: 12, color: "var(--text-3)" }}>Unlimited</span>}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 20 }}>Subscription term</td>
                  <td>{sub ? `${sub.totalDays - (sub.remainingDays ?? 0)} / ${sub.totalDays} days` : "-"}</td>
                  <td>
                    {sub ? (
                      <div className="td-usage-bar">
                        <div className="td-usage-bar__track"><div className={barFillClass(subElapsed)} style={{ width: `${Math.min(100, subElapsed)}%` }} /></div>
                        <span className="td-usage-bar__pct">{subElapsed}%</span>
                      </div>
                    ) : <span style={{ fontSize: 12, color: "var(--text-3)" }}>-</span>}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 20 }}>Users</td>
                  <td>{data.users.length}</td>
                  <td><span style={{ fontSize: 12, color: "var(--text-3)" }}>{data.users.filter((u2) => u2.isActive).length} active</span></td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 20 }}>Assets</td>
                  <td>{data.assetCount}</td>
                  <td><span style={{ fontSize: 12, color: "var(--text-3)" }}>{data.hierarchyLevels.length} hierarchy levels</span></td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 20 }}>Procedures</td>
                  <td>{u.total}</td>
                  <td><span style={{ fontSize: 12, color: "var(--text-3)" }}>{u.billable} billable · {u.nonBillable} non-billable</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Organisation details */}
        <div className="td-card">
          <div className="td-card__head">
            <span className="td-card__title">Organisation details</span>
          </div>
          <div className="td-org-grid">
            <div className="td-org-cell">
              <div className="td-org-cell__label">Legal name</div>
              <div className="td-org-cell__value">{o.name}</div>
            </div>
            <div className="td-org-cell">
              <div className="td-org-cell__label">Industry</div>
              <div className="td-org-cell__value">{o.industry ?? "-"}</div>
            </div>
            <div className="td-org-cell">
              <div className="td-org-cell__label">Org ID</div>
              <div className="td-org-cell__value">{o.orgId}</div>
            </div>
            <div className="td-org-cell">
              <div className="td-org-cell__label">Org code</div>
              <div className="td-org-cell__value">{o.orgCode ?? "-"}</div>
            </div>
            <div className="td-org-cell">
              <div className="td-org-cell__label">Address</div>
              <div className="td-org-cell__value">{addressParts.length > 0 ? addressParts.join("\n") : "-"}</div>
            </div>
            <div className="td-org-cell">
              <div className="td-org-cell__label">Customer since</div>
              <div className="td-org-cell__value">{fmtDate(o.activatedAt ?? o.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="td-overview__right">
        {/* Subscription */}
        <div className="td-card">
          <div className="td-card__head">
            <span className="td-card__title">Subscription</span>
            <button className="td-card__link" onClick={() => onTabSwitch("subscription")}>Manage</button>
          </div>
          <div className="td-card__body">
            {sub ? (
              <>
                <div className="td-sub-row">
                  <span className="td-sub-row__label">Plan</span>
                  <span className="td-sub-row__value">{sub.plan}</span>
                </div>
                <div className="td-sub-row">
                  <span className="td-sub-row__label">Status</span>
                  <span className="td-sub-row__value">
                    <span className={`td-dot td-dot--${sub.status === "ACTIVE" ? "ok" : sub.status === "TRIAL" ? "warn" : sub.status === "EXPIRED" ? "bad" : "muted"}`} />
                    {sub.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="td-sub-row">
                  <span className="td-sub-row__label">Started</span>
                  <span className="td-sub-row__value">{fmtDate(sub.startDate)}</span>
                </div>
                <div className="td-sub-row">
                  <span className="td-sub-row__label">Renews</span>
                  <span className="td-sub-row__value">{fmtDate(sub.endDate ?? sub.trialEndsAt)} ({sub.remainingDays ?? 0} days)</span>
                </div>
              </>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>No subscription configured.</span>
            )}
          </div>
        </div>

        {/* Contacts */}
        <div className="td-card">
          <div className="td-card__head">
            <span className="td-card__title">Contacts</span>
          </div>
          <div className="td-card__body">
            {data.contacts.length === 0 ? (
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>No contacts configured.</span>
            ) : (
              data.contacts.map((c) => (
                <div key={c.id} className="td-contact">
                  <div className="td-contact__top">
                    <span className="td-contact__name">{c.name}</span>
                    <span className="td-contact__badge">{c.isPrimary ? "Primary" : c.contactType}</span>
                  </div>
                  {c.designation && <div className="td-contact__title">{c.designation}</div>}
                  <div className="td-contact__info">
                    <a href={`mailto:${c.email}`}>{c.email}</a>
                    {c.phone && <><br />{c.phone}</>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageProgressBar({ used, included }: { used: number; included: number }) {
  const s = useStyles();
  if (included <= 0) return null;
  const pct = Math.round((used / included) * 100);
  const capped = Math.min(1, used / included);
  return (
    <div className={s.progressWrap}>
      <div className={s.progressLabel}>
        <span>{pct}% of included allowance used</span>
        <span>{used.toLocaleString()} / {included.toLocaleString()}</span>
      </div>
      <ProgressBar value={capped} color={usageBarColor(pct)} thickness="large" />
      {pct >= 100 && <Text className={s.tileHint} style={{ color: tokens.colorPaletteRedForeground1 }}>Exceeded: {(used - included).toLocaleString()} additional procedures used</Text>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Usage
// ---------------------------------------------------------------------------

function UsageTab({ data }: { data: TenantFullDetail }) {
  const s = useStyles();
  const u = data.usage;
  return (
    <div className={s.section}>
      <div className={s.grid}>
        <Tile label="Total executions" value={u.total} accent="blue" />
        <Tile label="Completed" value={u.completed} accent="green" />
        <Tile label="Failed" value={u.failed} accent={u.failed > 0 ? "red" : "blue"} />
        <Tile label="Cancelled" value={u.cancelled} accent="blue" />
        <Tile label="Billable" value={u.billable} accent="green" />
        <Tile label="Non-billable" value={u.nonBillable} accent="blue" />
      </div>

      {/* Included allowance section */}
      {u.includedAllowance != null && (
        <Card className={s.card}>
          <Text as="h3" weight="semibold">Procedure allowance</Text>
          <UsageProgressBar used={u.billable} included={u.includedAllowance} />
          <div className={s.grid} style={{ marginTop: tokens.spacingVerticalM }}>
            <Tile label="Included" value={u.includedAllowance} accent="blue" />
            <Tile label="Remaining" value={u.remainingIncluded} accent={u.remainingIncluded <= 0 ? "red" : "green"} />
            <Tile label="Additional used" value={u.additionalUsed} accent={u.additionalUsed > 0 ? "orange" : "blue"} />
          </div>
          {u.additionalCharges && <AdditionalChargesBreakdown charges={u.additionalCharges} included={u.includedAllowance} currency={data.subscription?.currency ?? "USD"} />}
        </Card>
      )}

      {/* Billing period usage */}
      <Card className={s.card}>
        <Text as="h3" weight="semibold">Billing period usage</Text>
        <div className={s.grid}>
          <Tile label="Current period" value={u.currentPeriodUsage ?? 0} accent="blue" />
          <Tile label="Previous period" value={u.previousPeriodUsage ?? 0} accent="blue" />
        </div>
      </Card>

      {/* Usage by category */}
      {u.usageByCategory && u.usageByCategory.length > 0 && (
        <Card className={s.card}>
          <Text as="h3" weight="semibold">Usage by category</Text>
          <DataTable<UsageByCategory>
            columns={[
              { key: "cat", header: "Category", render: (c) => c.categoryName },
              { key: "total", header: "Total", align: "right", render: (c) => <NumCell>{c.total.toLocaleString()}</NumCell> },
              { key: "billable", header: "Billable", align: "right", render: (c) => <NumCell>{c.billable.toLocaleString()}</NumCell> },
            ]}
            data={u.usageByCategory}
            rowKey={(c) => c.categoryKey}
          />
        </Card>
      )}
    </div>
  );
}

interface ChargeRow { key: string; description: string; quantity: string; rate: string; amount: string; bold?: boolean }

function AdditionalChargesBreakdown({ charges, included, currency }: { charges: AdditionalCharges; included: number; currency: string }) {
  const s = useStyles();
  const rows: ChargeRow[] = [
    { key: "incl", description: "Included procedures", quantity: included.toLocaleString(), rate: "Included", amount: fmtMoney(0, currency) },
    ...charges.breakdown.map((t) => ({
      key: `tier-${t.tierOrder}`,
      description: `Additional (tier ${t.tierOrder}: ${t.min.toLocaleString()}${t.max ? `–${t.max.toLocaleString()}` : "+"})`,
      quantity: t.quantity.toLocaleString(), rate: fmtMoney(t.rate, currency), amount: fmtMoney(t.amount, currency),
    })),
    { key: "total", description: "Total additional", quantity: charges.additionalQuantity.toLocaleString(), rate: "", amount: fmtMoney(charges.estimatedAmount, currency), bold: true },
  ];
  const chargeColumns: Column<ChargeRow>[] = [
    { key: "desc", header: "Description", render: (r) => r.bold ? <Text weight="bold">{r.description}</Text> : r.description },
    { key: "qty", header: "Quantity", align: "right", render: (r) => r.bold ? <Text weight="bold"><NumCell>{r.quantity}</NumCell></Text> : <NumCell>{r.quantity}</NumCell> },
    { key: "rate", header: "Rate", align: "right", render: (r) => r.rate },
    { key: "amt", header: "Amount", align: "right", render: (r) => r.bold ? <Text weight="bold">{r.amount}</Text> : r.amount },
  ];
  return (
    <div style={{ marginTop: tokens.spacingVerticalM }}>
      <Text as="h4" weight="semibold" size={200}>Additional charges breakdown</Text>
      <div style={{ marginTop: tokens.spacingVerticalS }}>
        <DataTable<ChargeRow> columns={chargeColumns} data={rows} rowKey={(r) => r.key} />
      </div>
      <div className={s.explanationBox} style={{ marginTop: tokens.spacingVerticalS }}>
        You can use up to {included.toLocaleString()} procedures within your current plan. Any additional procedure is charged at the applicable configured rate. Current estimated additional cost: <strong>{fmtMoney(charges.estimatedAmount, currency)}</strong>.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Pricing
// ---------------------------------------------------------------------------

function PricingTab({ data }: { data: TenantFullDetail }) {
  const s = useStyles();
  return (
    <div className={s.section}>
      {data.pricing.length === 0 ? (
        <Card className={s.card}>
          <Text>No pricing configurations found for this tenant.</Text>
          <Button appearance="primary" size="small" onClick={() => window.location.assign(`/pricing/${data.overview.orgId}`)}>Configure pricing</Button>
        </Card>
      ) : (
        <>
          <Button appearance="outline" size="small" onClick={() => window.location.assign(`/pricing/${data.overview.orgId}`)}>Manage pricing configurations</Button>
          {data.pricing.map((config) => (
            <PricingConfigCard key={config.id} config={config} />
          ))}
        </>
      )}
    </div>
  );
}

function PricingConfigCard({ config }: { config: TenantPricingConfig }) {
  const s = useStyles();
  return (
    <Card className={mergeClasses(s.card, config.status === "ACTIVE" ? s.tileAccentGreen : undefined)}>
      <div className={s.cardTitle}>
        <div className={s.badges}>
          <Text weight="semibold">{config.categoryName}</Text>
          <Badge appearance="outline">{config.pricingModel}</Badge>
          <StatusPill status={config.status} />
        </div>
        <Text className={s.tileHint}>v{config.version}</Text>
      </div>
      <dl className={s.dl}>
        <dt className={s.dt}>Currency</dt><dd className={s.dd}>{config.currency}</dd>
        <dt className={s.dt}>Billing period</dt><dd className={s.dd}>{config.billingPeriod}</dd>
        <dt className={s.dt}>Effective</dt><dd className={s.dd}>{fmtDate(config.effectiveFrom)} to {fmtDate(config.effectiveTo)}</dd>
      </dl>
      {config.tiers.length > 0 && (
        <DataTable<TenantPricingTier>
          columns={[
            { key: "tier", header: "Tier", render: (t) => t.tierOrder },
            { key: "min", header: "Min", align: "right", render: (t) => <NumCell>{t.minimumQuantity.toLocaleString()}</NumCell> },
            { key: "max", header: "Max", align: "right", render: (t) => <NumCell>{t.maximumQuantity?.toLocaleString() ?? "Unlimited"}</NumCell> },
            { key: "rate", header: "Rate", align: "right", render: (t) => `${config.currency} ${Number(t.unitRate).toFixed(2)}` },
          ]}
          data={config.tiers}
          rowKey={(t) => String(t.tierOrder)}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab: Billing & Invoices
// ---------------------------------------------------------------------------

function BillingTab({ data }: { data: TenantFullDetail }) {
  const s = useStyles();
  const b = data.billing;
  return (
    <div className={s.section}>
      <div className={s.grid}>
        <Tile label="Total invoiced" value={fmtMoney(b.totalInvoiced)} accent="blue" />
        <Tile label="Total paid" value={fmtMoney(b.totalPaid)} accent="green" />
        <Tile label="Outstanding" value={fmtMoney(b.totalOutstanding)} accent={Number(b.totalOutstanding) > 0 ? "orange" : "blue"} />
        <Tile label="Refunded" value={fmtMoney(b.totalRefunded)} accent="blue" />
        <Tile label="Overdue invoices" value={b.overdueInvoices ?? 0} accent={(b.overdueInvoices ?? 0) > 0 ? "red" : "blue"} />
        <Tile label="Pending payments" value={b.pendingPayments ?? 0} accent={(b.pendingPayments ?? 0) > 0 ? "orange" : "blue"} />
      </div>
      {b.lastInvoiceDate && (
        <Card className={s.card}>
          <dl className={s.dl}>
            <dt className={s.dt}>Last invoice</dt><dd className={s.dd}>{fmtDate(b.lastInvoiceDate)}</dd>
            <dt className={s.dt}>Next billing</dt><dd className={s.dd}>{fmtDate(b.nextBillingDate)}</dd>
          </dl>
        </Card>
      )}
      {b.invoices.length === 0 ? (
        <Card className={s.card}><Text className={s.tileHint}>No invoices generated yet.</Text></Card>
      ) : (
        <DataTable<TenantInvoiceSummary>
          columns={[
            { key: "inv", header: "Invoice", render: (inv) => <TextLink to={`/invoices/${inv.id}` as "/invoices/$invoiceId"} params={{ invoiceId: inv.id }}>{inv.invoiceNumber}</TextLink> },
            { key: "period", header: "Period", render: (inv) => `${fmtDate(inv.billingPeriodStart)} – ${fmtDate(inv.billingPeriodEnd)}` },
            { key: "currency", header: "Currency", render: (inv) => inv.currency },
            { key: "total", header: "Total", align: "right", render: (inv) => <NumCell>{Number(inv.total).toFixed(2)}</NumCell> },
            { key: "paid", header: "Paid", align: "right", render: (inv) => <NumCell>{Number(inv.amountPaid).toFixed(2)}</NumCell> },
            { key: "outstanding", header: "Outstanding", align: "right", render: (inv) => <NumCell>{Number(inv.outstanding).toFixed(2)}</NumCell> },
            { key: "status", header: "Status", render: (inv) => <StatusPill status={inv.status} /> },
            { key: "due", header: "Due", render: (inv) => fmtDate(inv.dueDate) },
          ]}
          data={b.invoices}
          rowKey={(inv) => inv.id}
          emptyMessage="No invoices generated yet."
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Payments
// ---------------------------------------------------------------------------

function PaymentsTab({ data }: { data: TenantFullDetail }) {
  const s = useStyles();
  const payments = data.payments;
  const totalPaid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPending = payments.filter((p) => p.status === "PENDING").length;
  const totalFailed = payments.filter((p) => p.status === "FAILED").length;
  const totalRefunded = payments.reduce((sum, p) => sum + Number(p.refundedAmount), 0);

  return (
    <div className={s.section}>
      <div className={s.grid}>
        <Tile label="Total paid" value={fmtMoney(totalPaid)} accent="green" />
        <Tile label="Pending" value={totalPending} accent={totalPending > 0 ? "orange" : "blue"} />
        <Tile label="Failed" value={totalFailed} accent={totalFailed > 0 ? "red" : "blue"} />
        <Tile label="Refunded" value={fmtMoney(totalRefunded)} accent="blue" />
      </div>
      {payments.length === 0 ? (
        <Card className={s.card}><Text className={s.tileHint}>No payment records.</Text></Card>
      ) : (
        <DataTable<TenantPaymentRecord>
          columns={[
            { key: "date", header: "Date", render: (p) => fmtDate(p.paidAt ?? p.createdAt) },
            { key: "invoice", header: "Invoice", render: (p) => p.invoiceNumber ?? "-" },
            { key: "amount", header: "Amount", align: "right", render: (p) => <NumCell>{fmtMoney(p.amount, p.currency)}</NumCell> },
            { key: "method", header: "Method", render: (p) => p.paymentMethod ?? "-" },
            { key: "status", header: "Status", render: (p) => <StatusPill status={p.status} /> },
            { key: "txn", header: "Transaction", render: (p) => <span style={{ fontSize: tokens.fontSizeBase100 }}>{p.transactionId ?? "-"}</span> },
            { key: "refunded", header: "Refunded", align: "right", render: (p) => Number(p.refundedAmount) > 0 ? <NumCell>{fmtMoney(p.refundedAmount, p.currency)}</NumCell> : "-" },
          ]}
          data={payments}
          rowKey={(p) => p.id}
          emptyMessage="No payment records."
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Subscription
// ---------------------------------------------------------------------------

function SubscriptionTab({ data }: { data: TenantFullDetail }) {
  const s = useStyles();
  const sub = data.subscription;
  const tenantId = data.overview.id;
  const actionMutation = useSubscriptionAction();

  if (!sub) return <Card className={s.card}><Text className={s.tileHint}>No subscription configured.</Text></Card>;

  const remainingDays = sub.remainingDays ?? 0;
  const activeDays = sub.activeDays ?? 0;
  const totalDays = sub.totalDays ?? 365;
  const progress = totalDays > 0 ? Math.min(1, Math.max(0, activeDays / totalDays)) : 1;

  let barColor: "brand" | "success" | "warning" | "error" = "success";
  if (remainingDays <= 0) barColor = "error";
  else if (remainingDays <= 30) barColor = "warning";

  const handleAction = (action: string) => {
    const reason = action === "CANCEL" ? prompt("Cancellation reason:") : undefined;
    const extendDays = action === "EXTEND" ? Number(prompt("Days to extend:") ?? 0) : undefined;
    if (action === "CANCEL" && !reason) return;
    if (action === "EXTEND" && (!extendDays || extendDays <= 0)) return;
    actionMutation.mutate({ tenantId, action, reason: reason ?? undefined, extendDays });
  };

  return (
    <div className={s.section}>
      <div className={s.grid}>
        <Tile label="Active days" value={activeDays} accent="blue" />
        <Tile label="Remaining days" value={remainingDays} accent={remainingDays <= 30 ? "orange" : "green"} />
        <Tile label="Total duration" value={`${totalDays} days`} accent="blue" />
      </div>

      <Card className={s.card}>
        <div className={s.cardTitle}>
          <Text as="h3" weight="semibold">Subscription details</Text>
          <StatusPill status={sub.status} />
        </div>
        <dl className={s.dl}>
          <dt className={s.dt}>Plan</dt><dd className={s.dd}>{sub.plan}</dd>
          <dt className={s.dt}>Model</dt><dd className={s.dd}>{sub.subscriptionModel.replace(/_/g, " ")}</dd>
          <dt className={s.dt}>Billing cycle</dt><dd className={s.dd}>{sub.billingCycle}</dd>
          <dt className={s.dt}>Monthly rate</dt><dd className={s.dd}>{fmtMoney(sub.monthlyRate, sub.currency)}</dd>
          <dt className={s.dt}>Currency</dt><dd className={s.dd}>{sub.currency}</dd>
          <dt className={s.dt}>Start date</dt><dd className={s.dd}>{fmtDate(sub.startDate)}</dd>
          <dt className={s.dt}>End date</dt><dd className={s.dd}>{fmtDate(sub.endDate)}</dd>
          {sub.trialEndsAt && <><dt className={s.dt}>Trial ends</dt><dd className={s.dd}>{fmtDate(sub.trialEndsAt)}</dd></>}
          {sub.renewalDate && <><dt className={s.dt}>Next renewal</dt><dd className={s.dd}>{fmtDate(sub.renewalDate)}</dd></>}
          {sub.nextBillingDate && <><dt className={s.dt}>Next billing</dt><dd className={s.dd}>{fmtDate(sub.nextBillingDate)}</dd></>}
          <dt className={s.dt}>Auto-renew</dt><dd className={s.dd}>{sub.autoRenew ? "Yes" : "No"}</dd>
          {sub.includedAllowance != null && <><dt className={s.dt}>Included allowance</dt><dd className={s.dd}>{sub.includedAllowance.toLocaleString()} procedures</dd></>}
          {sub.cancelledAt && <><dt className={s.dt}>Cancelled</dt><dd className={s.dd}>{fmtDate(sub.cancelledAt)}{sub.cancellationReason ? ` – ${sub.cancellationReason}` : ""}</dd></>}
          {sub.previousPlan && <><dt className={s.dt}>Previous plan</dt><dd className={s.dd}>{sub.previousPlan} at {fmtMoney(sub.previousMonthlyRate ?? "0", sub.currency)}</dd></>}
        </dl>
      </Card>

      <Card className={s.card}>
        <Text as="h3" weight="semibold">Subscription period</Text>
        <div className={s.progressWrap}>
          <div className={s.progressLabel}>
            <span>{fmtDate(sub.startDate)}</span>
            <span>{fmtDate(sub.endDate ?? sub.trialEndsAt)}</span>
          </div>
          <ProgressBar value={progress} color={barColor} thickness="large" />
          <div className={s.progressLabel}>
            <span>{activeDays} of {totalDays} days elapsed</span>
            <span style={{ fontWeight: tokens.fontWeightBold as unknown as number }}>{remainingDays} days remaining</span>
          </div>
        </div>
      </Card>

      <Card className={s.card}>
        <Text as="h3" weight="semibold">Actions</Text>
        <div className={s.badges}>
          {sub.status === "ACTIVE" && (
            <>
              <Button size="small" appearance="primary" icon={<ArrowClockwise24Regular />} onClick={() => handleAction("RENEW")} disabled={actionMutation.isPending}>Renew</Button>
              <Button size="small" appearance="outline" icon={<CalendarAdd24Regular />} onClick={() => handleAction("EXTEND")} disabled={actionMutation.isPending}>Extend</Button>
              <Button size="small" appearance="outline" icon={<Dismiss24Regular />} onClick={() => handleAction("SUSPEND")} disabled={actionMutation.isPending}>Suspend</Button>
              <Button size="small" appearance="subtle" onClick={() => handleAction("CANCEL")} disabled={actionMutation.isPending}>Cancel</Button>
            </>
          )}
          {sub.status === "SUSPENDED" && (
            <Button size="small" appearance="primary" icon={<Play24Regular />} onClick={() => handleAction("REACTIVATE")} disabled={actionMutation.isPending}>Reactivate</Button>
          )}
          {(sub.status === "EXPIRED" || sub.status === "CANCELLED") && (
            <Button size="small" appearance="primary" icon={<ArrowClockwise24Regular />} onClick={() => handleAction("RENEW")} disabled={actionMutation.isPending}>Renew</Button>
          )}
          {sub.status === "TRIAL" && (
            <>
              <Button size="small" appearance="primary" icon={<ArrowClockwise24Regular />} onClick={() => handleAction("RENEW")} disabled={actionMutation.isPending}>Convert to paid</Button>
              <Button size="small" appearance="outline" icon={<CalendarAdd24Regular />} onClick={() => handleAction("EXTEND")} disabled={actionMutation.isPending}>Extend trial</Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: History (comprehensive)
// ---------------------------------------------------------------------------

function HistoryTab({ data }: { data: TenantFullDetail }) {
  const s = useStyles();
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const allEntries = data.auditLog;
  const actions = [...new Set(allEntries.map((e) => e.action))].sort();

  let filtered = filter ? allEntries.filter((e) => e.action === filter) : allEntries;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((e) =>
      e.action.toLowerCase().includes(q) ||
      (e.reason ?? "").toLowerCase().includes(q) ||
      e.entityType.toLowerCase().includes(q) ||
      (e.performedBy?.email ?? "").toLowerCase().includes(q)
    );
  }
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className={s.section}>
      <div className={s.filterRow}>
        <Input
          className={s.searchInput}
          placeholder="Search history..."
          contentBefore={<Search24Regular />}
          value={search}
          onChange={(_, d) => { setSearch(d.value); setPage(0); }}
          size="small"
        />
        <Button size="small" appearance={filter === null ? "primary" : "outline"} onClick={() => { setFilter(null); setPage(0); }}>All ({allEntries.length})</Button>
        {actions.map((a) => (
          <Button key={a} size="small" appearance={filter === a ? "primary" : "outline"} onClick={() => { setFilter(a); setPage(0); }}>
            {a.replace(/_/g, " ")} ({allEntries.filter((e) => e.action === a).length})
          </Button>
        ))}
      </div>

      {paged.length === 0 ? (
        <Card className={s.card}><Text className={s.tileHint}>No activity recorded.</Text></Card>
      ) : (
        <div className={s.timeline}>
          {paged.map((e) => (
            <div key={e.id} className={s.timelineItem}>
              <div>
                <span className={s.timelineAction}>{e.action.replace(/_/g, " ")}</span>
                <span className={s.tileHint}> on {e.entityType}{e.entityId ? ` ${e.entityId.slice(0, 8)}...` : ""}</span>
                {e.reason && <span className={s.tileHint}> – {e.reason}</span>}
                {e.performedBy && (
                  <div className={s.timelineMeta}>
                    By: {e.performedBy.firstName ?? ""} {e.performedBy.lastName ?? ""} ({e.performedBy.email})
                  </div>
                )}
                {e.before != null && e.after != null && (
                  <div className={s.changeValues}>
                    <span className={s.oldValue}>{typeof e.before === "string" ? e.before : JSON.stringify(e.before)}</span>
                    <span>→</span>
                    <span className={s.newValue}>{typeof e.after === "string" ? e.after : JSON.stringify(e.after)}</span>
                  </div>
                )}
              </div>
              <span className={s.timelineDate}>{fmtDateTime(e.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className={s.filterRow} style={{ justifyContent: "center" }}>
          <Button size="small" appearance="subtle" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <Text size={200}>Page {page + 1} of {totalPages}</Text>
          <Button size="small" appearance="subtle" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Tenant Dialog
// ---------------------------------------------------------------------------

function EditTenantDialog({ data, tenantId }: { data: TenantFullDetail; tenantId: string }) {
  const o = data.overview;
  const updateMutation = useUpdateTenant();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: o.name, industry: o.industry ?? "", country: o.country ?? "", state: o.state ?? "",
    city: o.city ?? "", address: o.address ?? "", postalCode: o.postalCode ?? "",
    website: o.website ?? "", orgCode: o.orgCode ?? "", billingTimezone: o.billingTimezone,
    paymentTermsDays: String(o.paymentTermsDays),
  });

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    updateMutation.mutate({ tenantId, data: { ...form, paymentTermsDays: Number(form.paymentTermsDays) } as never }, {
      onSuccess: () => setOpen(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
      <DialogTrigger disableButtonEnhancement>
        <Button appearance="outline" size="small" icon={<Edit24Regular />}>Edit organisation</Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Edit tenant</DialogTitle>
          <DialogContent>
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Name"><Input value={form.name} onChange={(_, d) => set("name", d.value)} /></Field>
              <Field label="Org Code"><Input value={form.orgCode} onChange={(_, d) => set("orgCode", d.value)} /></Field>
              <Field label="Industry"><Input value={form.industry} onChange={(_, d) => set("industry", d.value)} /></Field>
              <Field label="Country"><Input value={form.country} onChange={(_, d) => set("country", d.value)} /></Field>
              <Field label="State"><Input value={form.state} onChange={(_, d) => set("state", d.value)} /></Field>
              <Field label="City"><Input value={form.city} onChange={(_, d) => set("city", d.value)} /></Field>
              <Field label="Address" style={{ gridColumn: "span 2" }}><Textarea value={form.address} onChange={(_, d) => set("address", d.value)} /></Field>
              <Field label="Postal Code"><Input value={form.postalCode} onChange={(_, d) => set("postalCode", d.value)} /></Field>
              <Field label="Website"><Input value={form.website} onChange={(_, d) => set("website", d.value)} /></Field>
              <Field label="Billing Timezone"><Input value={form.billingTimezone} onChange={(_, d) => set("billingTimezone", d.value)} /></Field>
              <Field label="Payment Terms (days)"><Input value={form.paymentTermsDays} onChange={(_, d) => set("paymentTermsDays", d.value)} type="number" /></Field>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement><Button appearance="secondary">Cancel</Button></DialogTrigger>
            <Button appearance="primary" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function TenantDetailContent({ orgId }: { orgId: string }) {
  const s = useStyles();
  const p = usePanelStyles();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const idLookup = useTenantIdByOrg(orgId);
  const tenantId = idLookup.data ?? null;
  const fullQuery = useTenantFull(tenantId);

  const handleTabSelect = (_: SelectTabEvent, d: SelectTabData) => {
    setActiveTab(d.value as TabKey);
  };

  if (idLookup.isPending || (tenantId !== null && fullQuery.isPending)) {
    return (
      <div className={mergeClasses(p.page, s.loading)}>
        <Skeleton><SkeletonItem style={{ height: 32, width: "40%" }} /></Skeleton>
        <Skeleton><SkeletonItem style={{ height: 40, width: "100%" }} /></Skeleton>
        <Skeleton><SkeletonItem style={{ height: 200 }} /></Skeleton>
        <Skeleton><SkeletonItem style={{ height: 200 }} /></Skeleton>
      </div>
    );
  }

  if (idLookup.isError || fullQuery.isError) {
    return (
      <div className={p.page}>
        <TextLink to="/tenants">Back to tenants</TextLink>
        <ErrorPanel error={idLookup.error ?? fullQuery.error ?? new Error("Unknown error")} onRetry={() => { void idLookup.refetch(); void fullQuery.refetch(); }} />
      </div>
    );
  }

  if (tenantId === null || !fullQuery.data) {
    return (
      <div className={p.page}>
        <TextLink to="/tenants">Back to tenants</TextLink>
        <Text>Tenant not found.</Text>
      </div>
    );
  }

  const data = fullQuery.data;
  const sub = data.subscription;
  const o = data.overview;
  const u = data.usage;

  const fmtCurrency = (v: string | number) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const inclRemaining = u.includedAllowance != null ? u.remainingIncluded : null;
  const inclPct = u.includedAllowance != null && u.includedAllowance > 0 ? Math.min(100, Math.round((u.billable / u.includedAllowance) * 100)) : 0;
  const inclBarClass = inclPct >= 90 ? "td-strip__bar-fill td-strip__bar-fill--bad" : inclPct >= 75 ? "td-strip__bar-fill td-strip__bar-fill--warn" : "td-strip__bar-fill";

  const locationParts = [o.city, o.state, o.country].filter(Boolean).join(", ");
  const subtitleParts = [o.orgCode, o.orgId, o.industry, locationParts, sub?.plan ? `${sub.plan} plan` : null].filter(Boolean).join(" · ");

  return (
    <div className={p.page}>
      {/* Breadcrumb */}
      <div className="td-crumbs">
        <a href="#" onClick={(e) => { e.preventDefault(); void navigate({ to: "/tenants" }); }}>Organisations</a>
        <span>/</span>
        {o.name}
      </div>

      {/* Header */}
      <div className="td-header">
        <div className="td-header__text">
          <div className="td-header__name">
            <h1>{o.name}</h1>
            <Badge appearance="tint" color={statusColor(o.status)} style={{ verticalAlign: "middle" }}>{o.status.replace(/_/g, " ")}</Badge>
          </div>
          <div className="td-header__sub">{subtitleParts}</div>
        </div>
        <div className="td-header__actions">
          <EditTenantDialog data={data} tenantId={tenantId} />
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="outline" icon={<MoreVertical24Regular />} size="small" />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem onClick={() => window.location.assign(`/pricing/${o.orgId}`)}>Manage pricing</MenuItem>
                <MenuItem onClick={() => void navigate({ to: "/invoices" })}>View invoices</MenuItem>
                <MenuItem onClick={() => void navigate({ to: "/payments" })}>View payments</MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      </div>

      {/* Expiry countdown */}
      {sub && (() => {
        const end = sub.endDate ?? sub.trialEndsAt;
        if (!end) return null;
        const remaining = Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
        if (remaining < 0 || remaining > 30) return null;
        return <ExpiryCountdown endDate={end} />;
      })()}

      {/* Summary strip */}
      <div className="td-strip">
        <div className="td-strip__card">
          <span className="td-strip__label td-strip__label--green">Revenue billed</span>
          <span className="td-strip__value">{fmtCurrency(data.billing.totalInvoiced)}</span>
          <span className="td-strip__hint">USD, lifetime</span>
        </div>
        <div className="td-strip__card">
          <span className="td-strip__label td-strip__label--orange">Outstanding</span>
          <span className="td-strip__value">{fmtCurrency(data.billing.totalOutstanding)}</span>
          <span className="td-strip__hint">{Number(data.billing.totalOutstanding) <= 0 ? "All invoices paid" : "Unpaid balance"}</span>
        </div>
        <div className="td-strip__card">
          <span className="td-strip__label td-strip__label--blue">Included remaining</span>
          <span className="td-strip__value">{inclRemaining != null ? inclRemaining : "-"}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)" }}> {u.includedAllowance != null ? `of ${u.includedAllowance}` : ""}</span></span>
          {u.includedAllowance != null && (
            <div className="td-strip__bar"><div className={inclBarClass} style={{ width: `${inclPct}%` }} /></div>
          )}
        </div>
        <div className="td-strip__card">
          <span className="td-strip__label td-strip__label--blue">Procedures used</span>
          <span className="td-strip__value">{u.total.toLocaleString()}</span>
          <span className="td-strip__hint">{u.billable} billable</span>
        </div>
        <div className="td-strip__card">
          <span className="td-strip__label td-strip__label--blue">Subscription remaining</span>
          <span className="td-strip__value">{sub ? `${sub.remainingDays ?? 0}` : "-"}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)" }}> days</span></span>
          <span className="td-strip__hint">{sub ? `ends ${fmtDate(sub.endDate ?? sub.trialEndsAt)}` : "no subscription"}</span>
        </div>
        <div className="td-strip__card">
          <span className="td-strip__label td-strip__label--blue">Active days</span>
          <span className="td-strip__value">{o.activeDays ?? 0}</span>
          <span className="td-strip__hint">since {fmtDate(o.activatedAt ?? o.createdAt)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="td-tabs">
        <TabList selectedValue={activeTab} onTabSelect={handleTabSelect} size="medium">
          <Tab value="overview">Overview</Tab>
          <Tab value="usage">Usage</Tab>
          <Tab value="pricing">Pricing</Tab>
          <Tab value="billing">Billing &amp; invoices</Tab>
          <Tab value="payments">Payments</Tab>
          <Tab value="subscription">Subscription</Tab>
          <Tab value="history">History</Tab>
        </TabList>
      </div>

      {activeTab === "overview" && <OverviewTab data={data} onTabSwitch={setActiveTab} />}
      {activeTab === "usage" && <UsageTab data={data} />}
      {activeTab === "pricing" && <PricingTab data={data} />}
      {activeTab === "billing" && <BillingTab data={data} />}
      {activeTab === "payments" && <PaymentsTab data={data} />}
      {activeTab === "subscription" && <SubscriptionTab data={data} />}
      {activeTab === "history" && <HistoryTab data={data} />}
    </div>
  );
}

export function TenantDetailPage({ orgId }: { orgId: string }) {
  return (
    <RequireRoles roles={["SUPER_ADMIN"]}>
      <TenantDetailContent orgId={orgId} />
    </RequireRoles>
  );
}

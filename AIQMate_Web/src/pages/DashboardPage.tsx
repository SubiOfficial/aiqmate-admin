// SPEC-036 US-003. Org-wide counts for every portal role (GET /dashboard/home), approvals waiting
// for approvers (GET /approvals), and a supervisor's line (GET /dashboard/summary).

import {
  Badge,
  Button,
  Card,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Text,
  makeStyles,
  tokens,
  type BadgeProps,
} from "@fluentui/react-components";
import {
  ArrowClockwise24Regular,
  ArrowRepeatAll24Regular,
  Board24Regular,
  ClipboardCheckmark24Regular,
  ClipboardTaskListLtr24Regular,
  DocumentSearch24Regular,
  Map24Regular,
  TaskListLtr24Regular,
  Wrench24Regular,
  type FluentIcon,
} from "@fluentui/react-icons";
import { ApiError } from "@/lib/api/client";
import { useDashboardHome, useDashboardSummary, usePendingApprovalsCount, type Activity } from "@/lib/api/dashboard";
import { hasAnyRole, isPlatformRole, primaryRole, type Role } from "@/lib/auth/roles";
import { Navigate } from "@tanstack/react-router";
import { useSession } from "@/lib/auth/session";
import { activityTone, formatCount, formatMoment, humanizeEnum, type StatusTone } from "@/lib/format";

// ADR-012 §7: the Super Admin is not an approver of any customer's work.
const APPROVERS: readonly Role[] = ["ORG_ADMIN", "MANAGER", "SUPERVISOR"];

const TONE: Record<StatusTone, BadgeProps["color"]> = {
  ok: "success",
  info: "brand",
  warn: "warning",
  bad: "danger",
  muted: "subtle",
};

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXL },
  sub: { color: tokens.colorNeutralForeground2 },
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "1fr",
    "@media (min-width: 480px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    "@media (min-width: 1280px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
  },
  lineGrid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "1fr",
    "@media (min-width: 480px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
  },
  tile: { minHeight: "112px", padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalXS },
  tileHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: tokens.spacingHorizontalM },
  tileLabel: { color: tokens.colorNeutralForeground2, overflowWrap: "anywhere" },
  well: {
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorBrandForeground1,
  },
  value: { fontVariantNumeric: "tabular-nums" },
  hint: { color: tokens.colorNeutralForeground3, marginTop: "auto" },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  listCard: { padding: 0, gap: 0 },
  listHead: { padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`, borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    ":last-child": { borderBottom: "none" },
  },
  rowTitle: { flex: "1 1 240px", minWidth: 0, overflowWrap: "anywhere" },
  time: { color: tokens.colorNeutralForeground3, fontVariantNumeric: "tabular-nums" },
  empty: { padding: tokens.spacingHorizontalXXL, textAlign: "center", color: tokens.colorNeutralForeground3 },
  list: { listStyle: "none", margin: 0, padding: 0 },
});

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Kpi({ label, value, icon: Icon, hint }: { label: string; value: number | undefined; icon: FluentIcon; hint?: string }) {
  const s = useStyles();
  return (
    <Card className={s.tile}>
      <div className={s.tileHead}>
        <Text weight="medium" className={s.tileLabel}>
          {label}
        </Text>
        <span className={s.well} aria-hidden="true">
          <Icon />
        </span>
      </div>
      {value === undefined ? (
        <Skeleton aria-label="Loading">
          <SkeletonItem shape="rectangle" size={32} style={{ width: 72 }} />
        </Skeleton>
      ) : (
        <Text size={800} weight="semibold" className={s.value}>
          {formatCount(value)}
        </Text>
      )}
      {hint && (
        <Text size={200} className={s.hint}>
          {hint}
        </Text>
      )}
    </Card>
  );
}

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const forbidden = error instanceof ApiError && error.status === 403;
  return (
    <MessageBar intent="error" layout="multiline">
      <MessageBarBody>{forbidden ? "Your role cannot read this." : "The AiQMate service could not be reached."}</MessageBarBody>
      <MessageBarActions>
        <Button icon={<ArrowClockwise24Regular />} onClick={onRetry}>
          Try again
        </Button>
      </MessageBarActions>
    </MessageBar>
  );
}

function ActivityList({ rows }: { rows: Activity[] }) {
  const s = useStyles();
  if (rows.length === 0) return <Text className={s.empty}>No activity on your line yet.</Text>;
  return (
    <ul className={s.list}>
      {rows.slice(0, 5).map((a) => (
        <li key={a.id} className={s.row}>
          <Text weight="medium" className={s.rowTitle}>
            {a.title}
          </Text>
          <Badge appearance="tint" color={TONE[activityTone(a.status)]}>
            {humanizeEnum(a.status)}
          </Badge>
          <Text size={200} className={s.time}>
            <time dateTime={a.createdAt}>{formatMoment(a.createdAt)}</time>
          </Text>
        </li>
      ))}
    </ul>
  );
}

/**
 * ADR-012 §7 / FR-WEB-013: the dashboard is customer data. A platform-role user is sent to the
 * Platform page before any customer request is made (the API would refuse them anyway).
 */
export function DashboardPage() {
  const session = useSession();
  if (isPlatformRole(session.roles)) return <Navigate to="/platform" replace />;
  return <TenantDashboard />;
}

function TenantDashboard() {
  const s = useStyles();
  const session = useSession();
  const userId = session.user.id;
  const isApprover = hasAnyRole(session.roles, APPROVERS);
  const isSupervisor = primaryRole(session.roles) === "SUPERVISOR";

  const home = useDashboardHome(userId);
  const approvals = usePendingApprovalsCount(userId, isApprover);
  const summary = useDashboardSummary(userId, isSupervisor);
  const k = home.data?.kpis;
  const line = summary.data?.role === "supervisor" ? summary.data : null;
  const firstName = session.user.displayName.split(" ")[0] ?? "";

  return (
    <div className={s.page}>
      <header>
        <Text as="h1" size={700} weight="semibold" block>
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </Text>
        <Text className={s.sub}>What is happening across your organisation today.</Text>
      </header>

      {home.isError ? (
        <ErrorPanel error={home.error} onRetry={() => void home.refetch()} />
      ) : (
        <section aria-label="Counts" className={s.grid}>
          {isApprover && (
            <Kpi
              label="Waiting for approval"
              value={approvals.data}
              icon={ClipboardCheckmark24Regular}
              hint="Procedures, routines, tasks and Flix"
            />
          )}
          <Kpi
            label="Open tasks"
            value={k?.tasks.count}
            icon={TaskListLtr24Regular}
            hint={k ? `${formatCount(k.tasks.inProgress)} in progress` : undefined}
          />
          <Kpi label="Procedures" value={k?.procedures} icon={ClipboardTaskListLtr24Regular} hint="Published" />
          <Kpi label="Routines" value={k?.routines} icon={ArrowRepeatAll24Regular} hint="Active" />
          <Kpi label="Inspections" value={k?.inspections} icon={DocumentSearch24Regular} hint="Active" />
          <Kpi label="Breakdown analyses" value={k?.bda} icon={Wrench24Regular} hint="Published" />
          <Kpi label="Audits" value={k?.audits} icon={Board24Regular} />
          <Kpi label="Area maps" value={k?.areaMaps} icon={Map24Regular} hint="Active" />
        </section>
      )}

      {isSupervisor && (
        <section aria-labelledby="line-heading" className={s.section}>
          <Text as="h2" id="line-heading" size={500} weight="semibold">
            Your line
          </Text>
          {summary.isError ? (
            <ErrorPanel error={summary.error} onRetry={() => void summary.refetch()} />
          ) : (
            <>
              <div className={s.lineGrid}>
                <Kpi label="Activities" value={line?.kpis.activities} icon={TaskListLtr24Regular} />
                <Kpi label="Pending approvals" value={line?.kpis.pendingApprovals} icon={ClipboardCheckmark24Regular} />
                <Kpi label="Assets" value={line?.kpis.assets} icon={Wrench24Regular} />
              </div>
              <Card className={s.listCard}>
                <Text as="h3" weight="semibold" className={s.listHead}>
                  Recent activity
                </Text>
                {line ? (
                  <ActivityList rows={line.recentActivities} />
                ) : (
                  <Skeleton aria-label="Loading" style={{ padding: 16 }}>
                    <SkeletonItem size={16} />
                  </Skeleton>
                )}
              </Card>
            </>
          )}
        </section>
      )}
    </div>
  );
}

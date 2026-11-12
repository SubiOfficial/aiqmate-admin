// SPEC-038 US-004. The Org Admin's monitoring of their own organisation: procedures, routines,
// tasks (overdue highlighted), audits and BDAs, and a 6-month trend.

import { CountsCard, ErrorPanel, KpiTile, LoadingTiles, PageHeader, TrendTable, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { moduleName, useOrgMetadata, type EffectiveMetadata } from "@/lib/api/metadata";
import { useOrgOverview, type OrgOverview } from "@/lib/api/orgAdmin";
import { useSession } from "@/lib/auth/session";
import { formatCount } from "@/lib/format";

// SPEC-039 FR-MD-011: headings use the tenant's names; the standard names until metadata loads.
function Overview({ data, meta }: { data: OrgOverview; meta: EffectiveMetadata | undefined }) {
  const p = usePanelStyles();
  const t = data.tasks;
  const procedures = moduleName(meta, "PROCEDURE", "plural");
  const routines = moduleName(meta, "ROUTINE", "plural");
  const inspections = moduleName(meta, "INSPECTION", "plural");
  const tasks = moduleName(meta, "TASK", "plural");
  return (
    <>
      <section aria-label="Key counts" className={p.grid}>
        <KpiTile label={`${procedures} published`} value={data.procedures.published} hint={`${formatCount(data.procedures.publishedLast30d)} in the last 30 days`} />
        <KpiTile label={`${routines} active`} value={data.routines.active} hint={`${inspections} published: ${formatCount(data.routines.inspectionsPublished)}`} />
        <KpiTile label={`${tasks} completed, 30 days`} value={t.completedLast30d} hint={`${formatCount(t.createdLast30d)} created`} />
        <KpiTile label={`${tasks} overdue`} value={t.overdue} warn={t.overdue > 0} hint="Past due and not done" />
      </section>

      <div className={p.twoCol}>
        <CountsCard
          title={procedures}
          rows={[
            { label: "Draft", value: data.procedures.draft },
            { label: "Pending approval", value: data.procedures.pendingApproval },
            { label: "Published", value: data.procedures.published },
            { label: "Archived", value: data.procedures.archived },
          ]}
        />
        <CountsCard
          title={tasks}
          rows={[
            { label: "Open", value: t.open },
            { label: "In progress", value: t.inProgress },
            { label: "Submitted for review", value: t.submittedForReview },
            { label: "Redo required", value: t.redoRequired },
            { label: "Overdue", value: t.overdue, warn: true },
          ]}
        />
        <CountsCard
          title={routines}
          rows={[
            { label: "Active", value: data.routines.active },
            { label: "Inactive", value: data.routines.inactive },
            { label: `${inspections} published`, value: data.routines.inspectionsPublished },
          ]}
        />
        <CountsCard
          title="Audits and breakdown analyses"
          rows={[
            { label: "Audits", value: data.audits.total },
            { label: "Audits, last 30 days", value: data.audits.last30d },
            { label: "Breakdown analyses", value: data.bdas.total },
            { label: "Breakdown analyses, last 30 days", value: data.bdas.last30d },
          ]}
        />
      </div>

      <TrendTable monthly={data.monthly} caption="Last 6 months" />
    </>
  );
}

function MonitoringPageContent() {
  const p = usePanelStyles();
  const session = useSession();
  const overview = useOrgOverview(session.user.id);
  const meta = useOrgMetadata(session.user.id, session.roles);
  return (
    <div className={p.page}>
      <PageHeader title="Monitoring" sub="How work is moving across your organisation." />
      {overview.isError ? (
        <ErrorPanel error={overview.error} onRetry={() => void overview.refetch()} />
      ) : overview.data ? (
        <Overview data={overview.data} meta={meta.data} />
      ) : (
        <LoadingTiles />
      )}
    </div>
  );
}

/** Gate first, so a role that may not open this page never sends its requests. */
export function MonitoringPage() {
  return (
    <RequireRoles roles={["ORG_ADMIN"]}>
      <MonitoringPageContent />
    </RequireRoles>
  );
}

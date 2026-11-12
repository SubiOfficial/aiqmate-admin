// SPEC-039 US-001 AC-2..3, US-002, US-005. One page for every Work module, titled with the tenant's
// name for it. Procedures, routines, inspections, guides and BDAs come from Lookup; tasks from
// activities. A module the tenant switched off says so and sends no list request.

import {
  Button,
  Card,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { CustomFieldsForm } from "@/components/CustomFieldsForm";
import { ErrorPanel, LoadingTiles, PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import { TextLink } from "@/components/TextLink";
import {
  isModuleEnabled,
  moduleName,
  useContentFields,
  useOrgMetadata,
  useSaveContentFields,
  type EffectiveMetadata,
} from "@/lib/api/metadata";
import { useLookupList, useTaskList, type ActivityItem, type LookupItem } from "@/lib/api/work";
import { effectiveRoles, hasAnyRole, type Role } from "@/lib/auth/roles";
import { useSession } from "@/lib/auth/session";
import { formatDay, formatMoment, humanizeEnum } from "@/lib/format";
import { moduleBySlug, type ModuleDef } from "@/lib/modules";
import { WORK_ROLES } from "@/lib/nav";

/** US-005 AC-1 / AC-5: who may change custom field values. Experts read them. */
const FIELD_EDITORS: readonly Role[] = ["ORG_ADMIN", "MANAGER", "SUPERVISOR"];

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalXXL, alignItems: "center", textAlign: "center", gap: tokens.spacingVerticalS },
  row: { cursor: "pointer" },
  wrap: { overflowWrap: "anywhere" },
  muted: { color: tokens.colorNeutralForeground3 },
  more: { display: "flex", justifyContent: "center", paddingTop: tokens.spacingVerticalM },
  drawerBody: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, paddingBottom: tokens.spacingVerticalXXL },
  dl: { display: "grid", gridTemplateColumns: "minmax(0, 120px) minmax(0, 1fr)", gap: tokens.spacingVerticalS, margin: 0 },
  dt: { color: tokens.colorNeutralForeground2, margin: 0 },
  dd: { margin: 0, overflowWrap: "anywhere" },
});

/** The core details the side panel shows, already as words. */
interface Selected {
  id: string;
  title: string;
  details: [string, string][];
}

function MessageCard({ title, body }: { title: string; body: string }) {
  const s = useStyles();
  return (
    <Card className={s.card}>
      <Text as="h1" size={500} weight="semibold" className={s.wrap}>
        {title}
      </Text>
      <Text className={s.wrap}>{body}</Text>
      <TextLink to="/dashboard">Go to the dashboard</TextLink>
    </Card>
  );
}

function LookupTable({ def, plural, onOpen }: { def: ModuleDef; plural: string; onOpen: (sel: Selected) => void }) {
  const p = usePanelStyles();
  const s = useStyles();
  const session = useSession();
  const type = def.source?.kind === "lookup" ? def.source.type : null;
  const list = useLookupList(session.user.id, type);
  if (list.isError) return <ErrorPanel error={list.error} onRetry={() => void list.refetch()} />;
  if (!list.data) return <LoadingTiles count={2} />;
  const items = list.data.data;
  const open = (i: LookupItem) =>
    onOpen({
      id: i.id,
      title: i.title,
      details: [
        ["Code", i.templateId || "No code"],
        ["Status", humanizeEnum(i.status)],
        ["Category", i.category ? humanizeEnum(i.category) : "No category"],
        ["Asset", i.assetName ?? "All assets"],
        ["Created by", i.createdByName || "Unknown"],
        ["Updated", formatMoment(i.updatedAt)],
      ],
    });
  return (
    <Card className={p.card}>
      {items.length === 0 ? (
        <Text className={p.empty}>No {plural.toLowerCase()} yet.</Text>
      ) : (
        <div className={p.scroll}>
          <Table aria-label={plural} size="medium" className={mergeClasses(p.table, p.tableWide)}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Title</TableHeaderCell>
                <TableHeaderCell>Code</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Asset</TableHeaderCell>
                <TableHeaderCell>Updated</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow
                  key={i.id}
                  className={s.row}
                  tabIndex={0}
                  onClick={() => open(i)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open(i))}
                >
                  <TableCell className={s.wrap}>{i.title}</TableCell>
                  <TableCell className={p.nowrap}>{i.templateId || "No code"}</TableCell>
                  <TableCell className={p.nowrap}>{humanizeEnum(i.status)}</TableCell>
                  <TableCell>{i.category ? humanizeEnum(i.category) : <span className={s.muted}>No category</span>}</TableCell>
                  <TableCell className={s.wrap}>{i.assetName ?? <span className={s.muted}>All assets</span>}</TableCell>
                  <TableCell className={p.nowrap}>{formatDay(i.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function TaskTable({ plural, onOpen }: { plural: string; onOpen: (sel: Selected) => void }) {
  const p = usePanelStyles();
  const s = useStyles();
  const session = useSession();
  const list = useTaskList(session.user.id, true);
  if (list.isError) return <ErrorPanel error={list.error} onRetry={() => void list.refetch()} />;
  if (!list.data) return <LoadingTiles count={2} />;
  const items = list.data.pages.flatMap((pg) => pg.data);
  const open = (t: ActivityItem) =>
    onOpen({
      id: t.id,
      title: t.title,
      details: [
        ["Status", humanizeEnum(t.status)],
        ["Assigned to", t.assignedToName ?? "Not assigned"],
        ["Due", t.dueDate ? formatDay(t.dueDate) : "No due date"],
        ["Asset", t.assetFullPath ?? "No asset"],
        ["Created", formatMoment(t.createdAt)],
      ],
    });
  return (
    <Card className={p.card}>
      {items.length === 0 ? (
        <Text className={p.empty}>No {plural.toLowerCase()} yet.</Text>
      ) : (
        <>
          <div className={p.scroll}>
            <Table aria-label={plural} size="medium" className={mergeClasses(p.table, p.tableWide)}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Title</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Assigned to</TableHeaderCell>
                  <TableHeaderCell>Due</TableHeaderCell>
                  <TableHeaderCell>Asset</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => (
                  <TableRow
                    key={t.id}
                    className={s.row}
                    tabIndex={0}
                    onClick={() => open(t)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open(t))}
                  >
                    <TableCell className={s.wrap}>{t.title}</TableCell>
                    <TableCell className={p.nowrap}>{humanizeEnum(t.status)}</TableCell>
                    <TableCell className={s.wrap}>{t.assignedToName ?? <span className={s.muted}>Not assigned</span>}</TableCell>
                    <TableCell className={p.nowrap}>{t.dueDate ? formatDay(t.dueDate) : <span className={s.muted}>No due date</span>}</TableCell>
                    <TableCell className={s.wrap}>{t.assetFullPath ?? <span className={s.muted}>No asset</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {list.hasNextPage && (
            <div className={s.more}>
              <Button onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? "Loading" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ItemFields({ def, id }: { def: ModuleDef; id: string }) {
  const session = useSession();
  const fields = useContentFields(session.user.id, def.key, id);
  const save = useSaveContentFields(session.user.id, def.key, id);
  const canEdit = hasAnyRole(effectiveRoles(session.roles), FIELD_EDITORS);
  if (fields.isError) return <ErrorPanel error={fields.error} onRetry={() => void fields.refetch()} />;
  if (!fields.data) return <LoadingTiles count={1} />;
  return (
    <CustomFieldsForm
      // A fresh form per item and per saved version, so the draft starts from what is stored.
      key={`${id}-${JSON.stringify(fields.data.values)}`}
      fields={fields.data.fields}
      values={fields.data.values}
      readOnly={!canEdit}
      onSave={(values) => save.mutateAsync(values)}
    />
  );
}

function ItemDrawer({ def, singular, selected, onClose }: { def: ModuleDef; singular: string; selected: Selected | null; onClose: () => void }) {
  const s = useStyles();
  return (
    <OverlayDrawer position="end" size="medium" open={selected !== null} onOpenChange={(_, d) => !d.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}
        >
          <span className={s.wrap}>{selected?.title ?? singular}</span>
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className={s.drawerBody}>
        {selected && (
          <>
            <dl className={s.dl}>
              {selected.details.map(([label, value]) => (
                <div key={label} style={{ display: "contents" }}>
                  <dt className={s.dt}>{label}</dt>
                  <dd className={s.dd}>{value}</dd>
                </div>
              ))}
            </dl>
            {def.supportsCustomFields && (
              <section aria-label="Custom fields">
                <Text as="h2" size={400} weight="semibold" block>
                  Custom fields
                </Text>
                <ItemFields def={def} id={selected.id} />
              </section>
            )}
          </>
        )}
      </DrawerBody>
    </OverlayDrawer>
  );
}

function ModuleContent({ def, meta }: { def: ModuleDef; meta: EffectiveMetadata }) {
  const p = usePanelStyles();
  const [selected, setSelected] = useState<Selected | null>(null);
  const plural = moduleName(meta, def.key, "plural");
  const singular = moduleName(meta, def.key, "singular");

  // US-001 AC-3: switched off, the page says so and asks for nothing.
  if (!isModuleEnabled(meta, def.key)) {
    return <MessageCard title={plural} body={`${plural} is turned off for your organisation.`} />;
  }
  if (def.source === null) {
    return <MessageCard title={plural} body="This page is not built yet." />;
  }
  return (
    <div className={p.page}>
      <PageHeader title={plural} sub={`${plural} of your organisation. Open one to see its details and custom fields.`} />
      {def.source.kind === "activities" ? (
        <TaskTable plural={plural} onOpen={setSelected} />
      ) : (
        <LookupTable def={def} plural={plural} onOpen={setSelected} />
      )}
      <ItemDrawer def={def} singular={singular} selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ModulePageContent({ def }: { def: ModuleDef }) {
  const session = useSession();
  // The metadata decides whether the module is on, so the list waits for it.
  const meta = useOrgMetadata(session.user.id, session.roles);
  if (meta.isError) return <ErrorPanel error={meta.error} onRetry={() => void meta.refetch()} />;
  if (!meta.data) return <LoadingTiles />;
  return <ModuleContent def={def} meta={meta.data} />;
}

/** Gate first, so a role that may not open this page never sends its requests. */
export function ModulePage({ slug }: { slug: string }) {
  const def = moduleBySlug(slug);
  if (!def) return <MessageCard title="This page could not be found" body="There is no module at this address." />;
  return (
    <RequireRoles roles={WORK_ROLES}>
      <ModulePageContent def={def} />
    </RequireRoles>
  );
}

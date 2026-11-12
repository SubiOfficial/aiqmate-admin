// SPEC-038 US-005. Who did what and when in the Org Admin's own organisation, newest first, merged
// from tasks, people (identity), content revisions and audits.

import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
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
  type BadgeProps,
} from "@fluentui/react-components";
import { ChevronLeft24Regular, ChevronRight24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { ErrorPanel, LoadingTiles, PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import {
  TRAIL_PAGE_SIZE,
  TRAIL_SOURCES,
  TRAIL_SOURCE_LABEL,
  useActivityTrail,
  type TrailSource,
} from "@/lib/api/orgAdmin";
import { useSession } from "@/lib/auth/session";
import { formatMoment, humanizeEnum } from "@/lib/format";

const useStyles = makeStyles({
  filters: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, alignItems: "flex-end" },
  filter: { minWidth: "160px", flex: "1 1 160px", maxWidth: "240px" },
  pager: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalM },
  wrap: { overflowWrap: "anywhere" },
  muted: { color: tokens.colorNeutralForeground3 },
  time: { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
});

const SOURCE_COLOR: Record<TrailSource, BadgeProps["color"]> = {
  TASK: "brand",
  PEOPLE: "important",
  CONTENT: "success",
  AUDIT: "warning",
};

function ActivityTrailPageContent() {
  const p = usePanelStyles();
  const s = useStyles();
  const session = useSession();
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<TrailSource | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const trail = useActivityTrail(session.user.id, {
    page,
    source: source || undefined,
    from: from || undefined,
    to: to || undefined,
  });
  const total = trail.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (trail.data?.limit ?? TRAIL_PAGE_SIZE)));

  return (
    <div className={p.page}>
      <PageHeader title="Activity trail" sub="Who did what and when in your organisation, newest first." />

      <Card className={p.card}>
        <div className={s.filters}>
          <Field label="Source" className={s.filter}>
            <Select
              value={source}
              onChange={(_, d) => {
                setSource(d.value as TrailSource | "");
                setPage(1);
              }}
            >
              <option value="">All</option>
              {TRAIL_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {TRAIL_SOURCE_LABEL[src]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From" className={s.filter}>
            <Input
              type="date"
              value={from}
              onChange={(_, d) => {
                setFrom(d.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="To" className={s.filter}>
            <Input
              type="date"
              value={to}
              onChange={(_, d) => {
                setTo(d.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
      </Card>

      {trail.isError ? (
        <ErrorPanel error={trail.error} onRetry={() => void trail.refetch()} />
      ) : !trail.data ? (
        <LoadingTiles count={2} />
      ) : (
        <Card className={p.card}>
          {trail.data.items.length === 0 ? (
            <Text className={p.empty}>Nothing happened in this period.</Text>
          ) : (
            <div className={p.scroll}>
              <Table aria-label="Activity trail" size="small" className={mergeClasses(p.table, p.tableWide)}>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>When</TableHeaderCell>
                    <TableHeaderCell>Who</TableHeaderCell>
                    <TableHeaderCell>Source</TableHeaderCell>
                    <TableHeaderCell>What happened</TableHeaderCell>
                    <TableHeaderCell>Item</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trail.data.items.map((e) => (
                    <TableRow key={`${e.source}-${e.id}`}>
                      <TableCell className={s.time}>{formatMoment(e.occurredAt)}</TableCell>
                      <TableCell className={s.wrap}>{e.actor.name ?? (e.actor.id ? "Unknown user" : "System")}</TableCell>
                      <TableCell>
                        <Badge className={p.nowrap} appearance="tint" color={SOURCE_COLOR[e.source] ?? "informative"}>
                          {TRAIL_SOURCE_LABEL[e.source] ?? humanizeEnum(e.source)}
                        </Badge>
                      </TableCell>
                      <TableCell className={s.wrap}>{e.summary}</TableCell>
                      <TableCell className={s.wrap}>
                        {e.subject.title ?? <span className={s.muted}>{humanizeEnum(e.subject.type)}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className={s.pager}>
            <Button icon={<ChevronLeft24Regular />} disabled={page <= 1 || trail.isFetching} onClick={() => setPage((n) => n - 1)}>
              Previous
            </Button>
            <Text>
              Page {page} of {pages}
            </Text>
            <Button
              icon={<ChevronRight24Regular />}
              iconPosition="after"
              disabled={page >= pages || trail.isFetching}
              onClick={() => setPage((n) => n + 1)}
            >
              Next
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Gate first, so a role that may not open this page never sends its requests. */
export function ActivityTrailPage() {
  return (
    <RequireRoles roles={["ORG_ADMIN"]}>
      <ActivityTrailPageContent />
    </RequireRoles>
  );
}

// SPEC-038. Small building blocks shared by the platform and Org Admin pages: page header, KPI tile,
// labelled counts, error and loading states, and the 6-month trend table.

import {
  Button,
  Card,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
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
import { ArrowClockwise24Regular } from "@fluentui/react-icons";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import type { MonthlyPoint } from "@/lib/api/orgAdmin";
import { formatCount, formatMonth } from "@/lib/format";

export const usePanelStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXL, minWidth: 0 },
  sub: { color: tokens.colorNeutralForeground2, overflowWrap: "anywhere" },
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "1fr",
    "@media (min-width: 480px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    "@media (min-width: 1280px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
  },
  twoCol: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "1fr",
    "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  },
  tile: { minHeight: "104px", padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalXS },
  tileWarn: { borderLeft: `4px solid ${tokens.colorPaletteMarigoldBorderActive}` },
  tileLabel: { color: tokens.colorNeutralForeground2, overflowWrap: "anywhere" },
  value: { fontVariantNumeric: "tabular-nums" },
  hint: { color: tokens.colorNeutralForeground3, marginTop: "auto", overflowWrap: "anywhere" },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM, minWidth: 0 },
  cardHead: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  counts: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: tokens.spacingHorizontalL, rowGap: tokens.spacingVerticalS, margin: 0 },
  countLabel: { color: tokens.colorNeutralForeground2, overflowWrap: "anywhere", margin: 0 },
  countValue: { fontVariantNumeric: "tabular-nums", textAlign: "right", fontWeight: tokens.fontWeightSemibold, margin: 0 },
  countWarn: { color: tokens.colorPaletteDarkOrangeForeground1 },
  scroll: { overflowX: "auto", maxWidth: "100%" },
  // Fluent's Table is `table-layout: fixed`, which squeezes every column to the same width and lets
  // headers and badges run into the next column. Columns size to their content instead, and below
  // the table's minimum width the card scrolls sideways (inside `scroll`), never overlaps.
  table: { tableLayout: "auto", minWidth: "480px" },
  tableWide: { minWidth: "720px" },
  tableWidest: { minWidth: "980px" },
  // A badge has a fixed height; text that wraps inside one draws over the next line.
  nowrap: { whiteSpace: "nowrap" },
  num: { fontVariantNumeric: "tabular-nums" },
  empty: { color: tokens.colorNeutralForeground3, padding: `${tokens.spacingVerticalL} 0` },
});

export function PageHeader({ title, sub, aside }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  const s = usePanelStyles();
  return (
    <header className={s.cardHead}>
      <div style={{ minWidth: 0 }}>
        <Text as="h1" size={700} weight="semibold" block>
          {title}
        </Text>
        {sub && (
          <Text className={s.sub} block>
            {sub}
          </Text>
        )}
      </div>
      {aside}
    </header>
  );
}

export function KpiTile({ label, value, hint, warn }: { label: string; value: ReactNode; hint?: string; warn?: boolean }) {
  const s = usePanelStyles();
  return (
    <Card className={mergeClasses(s.tile, warn && s.tileWarn)}>
      <Text weight="medium" className={s.tileLabel}>
        {label}
      </Text>
      <Text size={800} weight="semibold" className={s.value}>
        {typeof value === "number" ? formatCount(value) : value}
      </Text>
      {hint && (
        <Text size={200} className={s.hint}>
          {hint}
        </Text>
      )}
    </Card>
  );
}

/** A titled card of label / number pairs. `warn` keys are highlighted (e.g. overdue). */
export function CountsCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; warn?: boolean }[];
}) {
  const s = usePanelStyles();
  return (
    <Card className={s.card}>
      <Text as="h2" size={500} weight="semibold">
        {title}
      </Text>
      <dl className={s.counts}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "contents" }}>
            <dt className={mergeClasses(s.countLabel, r.warn && r.value > 0 && s.countWarn)}>{r.label}</dt>
            <dd className={mergeClasses(s.countValue, r.warn && r.value > 0 && s.countWarn)}>{formatCount(r.value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const text =
    status === 403
      ? "Your role cannot read this."
      : status === 404
        ? "This could not be found."
        : "The AiQMate service could not be reached.";
  return (
    <MessageBar intent="error" layout="multiline">
      <MessageBarBody>{text}</MessageBarBody>
      <MessageBarActions>
        <Button icon={<ArrowClockwise24Regular />} onClick={onRetry}>
          Try again
        </Button>
      </MessageBarActions>
    </MessageBar>
  );
}

export function LoadingTiles({ count = 4 }: { count?: number }) {
  const s = usePanelStyles();
  return (
    <div className={s.grid} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className={s.tile}>
          <Skeleton aria-label="Loading">
            <SkeletonItem shape="rectangle" size={16} style={{ width: "60%" }} />
            <SkeletonItem shape="rectangle" size={32} style={{ width: 72, marginTop: 8 }} />
          </Skeleton>
        </Card>
      ))}
    </div>
  );
}

export function TrendTable({ monthly, caption }: { monthly: MonthlyPoint[]; caption: string }) {
  const s = usePanelStyles();
  return (
    <Card className={s.card}>
      <Text as="h2" size={500} weight="semibold">
        {caption}
      </Text>
      {monthly.length === 0 ? (
        <Text className={s.empty}>No months to show yet.</Text>
      ) : (
        <div className={s.scroll}>
          <Table size="small" aria-label={caption} className={s.table}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Month</TableHeaderCell>
                <TableHeaderCell>Tasks created</TableHeaderCell>
                <TableHeaderCell>Tasks completed</TableHeaderCell>
                <TableHeaderCell>Procedures published</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly.map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{formatMonth(m.month)}</TableCell>
                  <TableCell className={s.num}>{formatCount(m.tasksCreated)}</TableCell>
                  <TableCell className={s.num}>{formatCount(m.tasksCompleted)}</TableCell>
                  <TableCell className={s.num}>{formatCount(m.proceduresPublished)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

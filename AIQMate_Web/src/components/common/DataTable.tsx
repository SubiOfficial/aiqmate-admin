import {
  Badge,
  Button,
  Skeleton,
  SkeletonItem,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { ChevronLeft20Regular, ChevronRight20Regular } from "@fluentui/react-icons";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Column / Pagination types
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render: (row: T, index: number) => ReactNode;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  pagination?: PaginationInfo;
  rowKey?: (row: T, index: number) => string;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Styles — the single source of truth for every table in the app
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  wrapper: {
    overflowX: "auto",
    maxWidth: "100%",
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: tokens.fontSizeBase200,
  },
  thead: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  th: {
    textAlign: "left",
    padding: "11px 16px",
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    whiteSpace: "nowrap",
    userSelect: "none",
  },
  thRight: { textAlign: "right" },
  thCenter: { textAlign: "center" },
  tr: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    cursor: "default",
    transitionProperty: "background-color",
    transitionDuration: tokens.durationNormal,
    ":last-child": { borderBottom: "none" },
    ":hover": { backgroundColor: tokens.colorNeutralBackground2 },
    ":nth-child(even)": { backgroundColor: tokens.colorNeutralBackground3 },
    ":nth-child(even):hover": { backgroundColor: tokens.colorNeutralBackground2 },
  },
  clickable: { cursor: "pointer" },
  td: {
    padding: "12px 16px",
    verticalAlign: "middle",
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    whiteSpace: "nowrap",
  },
  tdRight: { textAlign: "right" },
  tdCenter: { textAlign: "center" },
  compact: {},
  empty: {
    padding: tokens.spacingHorizontalXXL,
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  pager: { display: "flex", alignItems: "center", gap: "4px" },
  skeletonRow: {
    display: "flex",
    gap: "16px",
    padding: "14px 16px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
  },
});

// ---------------------------------------------------------------------------
// Badge helpers — reusable cell renderers
// ---------------------------------------------------------------------------

const pillStyle = { borderRadius: "50px" } as const;

type StatusColor = "success" | "danger" | "warning" | "informative" | "brand" | "subtle";

const STATUS_MAP: Record<string, StatusColor> = {
  ACTIVE: "success", PAID: "success", COMPLETED: "success", HEALTHY: "success", OK: "success",
  EXPIRED: "danger", FAILED: "danger", OVERDUE: "danger", CANCELLED: "danger", SUSPENDED: "danger",
  EXPIRING_SOON: "warning", PENDING: "warning", TRIAL: "informative", DRAFT: "informative",
};

export function StatusPill({ status }: { status: string }) {
  const color = STATUS_MAP[status.toUpperCase()] ?? "brand";
  return <Badge appearance="tint" color={color} style={pillStyle}>{status.replace(/_/g, " ")}</Badge>;
}

export function HealthPill({ health }: { health: string }) {
  const upper = health.toUpperCase();
  const label = upper === "OK" ? "Healthy" : health.replace(/_/g, " ");
  const color = upper === "OK" ? "success" : upper === "ATTENTION" ? "warning" : "danger";
  return <Badge appearance="tint" color={color} style={pillStyle}>{label}</Badge>;
}

export function EmailBadge({ email }: { email: string }) {
  return <Badge appearance="outline" size="small" style={{ fontWeight: 400, borderRadius: "4px" }}>{email}</Badge>;
}

export function ContactCell({ name, email }: { name: string; email: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
      <span>{name}</span>
      <span style={{ fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3 }}>{email}</span>
    </div>
  );
}

export function TenantCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
      <span style={{ fontWeight: 600 }}>{name}</span>
      {sub && <span style={{ fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3 }}>{sub}</span>}
    </div>
  );
}

export function NumCell({ children }: { children: ReactNode }) {
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{children}</span>;
}

// ---------------------------------------------------------------------------
// DataTable component
// ---------------------------------------------------------------------------

export function DataTable<T>({ columns, data, loading, emptyMessage = "No data to show.", onRowClick, pagination, rowKey, compact }: Props<T>) {
  const s = useStyles();

  if (loading) {
    return (
      <div className={s.wrapper}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={s.skeletonRow}>
            <Skeleton style={{ flexGrow: 1 }}><SkeletonItem style={{ height: "20px" }} /></Skeleton>
            <Skeleton style={{ width: "120px" }}><SkeletonItem style={{ height: "20px" }} /></Skeleton>
            <Skeleton style={{ width: "80px" }}><SkeletonItem style={{ height: "20px" }} /></Skeleton>
          </div>
        ))}
      </div>
    );
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;
  const from = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 1;
  const to = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : data.length;

  return (
    <div className={mergeClasses(s.wrapper, compact ? s.compact : undefined)}>
      <table className={s.table}>
        <thead className={s.thead}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={mergeClasses(s.th, col.align === "right" ? s.thRight : col.align === "center" ? s.thCenter : undefined)}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={s.empty}>
                <Text>{emptyMessage}</Text>
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={rowKey ? rowKey(row, idx) : idx}
                className={mergeClasses(s.tr, onRowClick ? s.clickable : undefined)}
                onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={mergeClasses(s.td, col.align === "right" ? s.tdRight : col.align === "center" ? s.tdCenter : undefined)}
                  >
                    {col.render(row, idx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {pagination && pagination.total > 0 && (
        <div className={s.footer}>
          <span>Showing {from} to {to} of {pagination.total}</span>
          <span className={s.pager}>
            <Button
              appearance="subtle"
              size="small"
              icon={<ChevronLeft20Regular />}
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            />
            <Text weight="semibold" size={200}>{pagination.page} / {totalPages}</Text>
            <Button
              appearance="subtle"
              size="small"
              icon={<ChevronRight20Regular />}
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            />
          </span>
        </div>
      )}
    </div>
  );
}

import React, { useState, useCallback } from "react";
import { MultiSelect } from "@/components/MultiSelect";
import {
  Building20Regular,
  People20Regular,
  Money20Regular,
  CheckmarkCircle20Regular,
  ArrowDownload20Regular,
  Add20Regular,
  Calendar20Regular,
  ChevronRight16Regular,
  MoreHorizontal20Regular,
  Warning20Regular,
  Payment20Regular,
  ArrowTrending20Regular,
  Dismiss20Regular,
  Timer20Regular,
  CubeTree20Regular,
  Receipt20Regular,
  MoneyOff20Regular,
  CalendarCancel20Regular,
  ErrorCircle20Regular,
} from "@fluentui/react-icons";
import { useNavigate } from "@tanstack/react-router";
import { RequireRoles } from "@/components/RequireRoles";
import {
  useDashboardSummary,
  useTenantsDetail,
  useSubscriptionsExpiry,
  useRevenueBreakdown,
  useUsersSummary,
  useProceduresSummary,
  usePaymentsDetail,
  useOutstandingDetail,
  type TenantDetailRow,
} from "@/lib/api/dashboardAdmin";

function formatCurrency(val: string | number | null | undefined): string {
  if (val == null) return "$0.00";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (Number.isNaN(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tenantInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

type DrillType = "tenants" | "users" | "collected" | "subscriptions" | "procedures" | "outstanding" | "pending" | "failed" | null;

function isExpiringSoon(sub: TenantDetailRow["subscription"]): { expiring: boolean; days: number } {
  if (!sub) return { expiring: false, days: 0 };
  const end = sub.endDate ?? sub.trialEndsAt;
  if (!end) return { expiring: false, days: 0 };
  const days = Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
  return { expiring: days >= 0 && days <= 30, days };
}

function TenantKebab({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const scrollHandler = () => setOpen(false);
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", scrollHandler, true);
    return () => { document.removeEventListener("mousedown", handler); window.removeEventListener("scroll", scrollHandler, true); };
  }, [open]);
  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const up = rect.bottom + 180 > window.innerHeight;
      setPos({ top: up ? rect.top : rect.bottom + 4, left: rect.right - 180, up });
    }
    setOpen(!open);
  };
  return (
    <div className="kebab-wrap" ref={ref}>
      <button className="kebab" onClick={handleOpen}><MoreHorizontal20Regular /></button>
      {open && (
        <div ref={menuRef} className="kebab-menu kebab-menu--fixed" style={pos.up ? { bottom: window.innerHeight - pos.top, left: pos.left } : { top: pos.top, left: pos.left }}>
          <button className="kebab-menu__item" onClick={(e) => { e.stopPropagation(); setOpen(false); void navigate({ to: "/tenants/$orgId", params: { orgId } }); }}>View details</button>
          <button className="kebab-menu__item" onClick={(e) => { e.stopPropagation(); setOpen(false); window.location.assign(`/pricing/${orgId}`); }}>Manage pricing</button>
          <button className="kebab-menu__item" onClick={(e) => { e.stopPropagation(); setOpen(false); void navigate({ to: "/invoices" }); }}>View invoices</button>
          <button className="kebab-menu__item" onClick={(e) => { e.stopPropagation(); setOpen(false); void navigate({ to: "/payments" }); }}>View payments</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drill-down panels
// ---------------------------------------------------------------------------

function CollectedDrilldown() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rev = useRevenueBreakdown(search, page);
  const d = rev.data;
  const totalCollected = d ? parseFloat(d.summary.totalCollected) : 0;
  return (
    <div className="card drilldown">
      <div className="drilldown__head">
        <div>
          <div className="drilldown__title">Where the {formatCurrency(totalCollected)} came from</div>
          <div className="drilldown__subtitle">{d ? `${d.items.length} paying tenants` : "Loading..."}</div>
        </div>
      </div>
      <div className="drilldown__filters">
        <input placeholder="Search tenant..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <div className="drilldown__body table-card">
        {d && <div className="table-card__head"><span className="table-count">{d.items.length} records</span></div>}
        <table className="table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Invoiced</th>
              <th>Collected</th>
              <th>Outstanding</th>
              <th>Last payment</th>
              <th>Status</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {d?.items.map((t) => {
              const share = totalCollected > 0 ? (parseFloat(t.totalPaid) / totalCollected * 100) : 0;
              return (
                <tr key={t.tenantId} style={{ cursor: "pointer" }} onClick={() => void navigate({ to: "/tenants/$orgId", params: { orgId: t.orgId } })}>
                  <td><div className="tenant-cell"><div className="avatar">{tenantInitials(t.name)}</div><div><b>{t.name}</b></div></div></td>
                  <td>{formatCurrency(t.totalInvoiced)}</td>
                  <td><b>{formatCurrency(t.totalPaid)}</b></td>
                  <td className={parseFloat(t.outstanding) > 0 ? "is-attention" : ""}>{formatCurrency(t.outstanding)}</td>
                  <td>{fmtDate(t.lastPaymentDate)}</td>
                  <td><span className={`badge${t.paymentStatus === "PAID" ? "" : t.paymentStatus === "PENDING" ? " badge--ghost" : ""}`}>
                    <span className={`dot dot--${t.paymentStatus === "PAID" ? "ok" : t.paymentStatus === "FAILED" ? "bad" : "warn"}`} />{t.paymentStatus}
                  </span></td>
                  <td>
                    <div className="share-bar">
                      <div className="share-bar__track"><div className="share-bar__fill" style={{ width: `${Math.min(100, share)}%` }} /></div>
                      <span className="share-bar__label">{share.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            }) ?? <tr><td colSpan={7} className="empty">Loading...</td></tr>}
            {d && (
              <tr style={{ fontWeight: 600 }}>
                <td>Total</td><td>{formatCurrency(d.summary.totalInvoiced)}</td><td>{formatCurrency(d.summary.totalCollected)}</td>
                <td>{formatCurrency(d.summary.totalOutstanding)}</td><td colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {d && d.total > 10 && (
        <div className="drilldown__footer">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="drilldown__pager">Page {d.page} of {Math.ceil(d.total / d.limit)}</span>
          <button className="btn" disabled={page * 10 >= d.total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

function TenantsDrilldown() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const status = statusFilter.join(",");
  const tenants = useTenantsDetail(search, status, page, "name", "asc");
  const d = tenants.data;
  const handleStatusChange = useCallback((v: string[]) => { setStatusFilter(v); setPage(1); }, []);
  return (
    <div className="card drilldown">
      <div className="drilldown__head">
        <div>
          <div className="drilldown__title">All tenants</div>
          <div className="drilldown__subtitle">{d ? `${d.total} organisations` : "Loading..."}</div>
        </div>
      </div>
      <div className="drilldown__filters">
        <input placeholder="Search tenant..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <MultiSelect
          placeholder="All statuses"
          options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]}
          value={statusFilter}
          onChange={handleStatusChange}
        />
      </div>
      <div className="drilldown__body table-card">
        {d && <div className="table-card__head"><span className="table-count">{d.total} records</span></div>}
        <table className="table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Industry</th>
              <th>Country</th>
              <th>Users</th>
              <th>Plan</th>
              <th>Subscription</th>
              <th>Expiry</th>
              <th>Procedures</th>
              <th>Invoiced</th>
              <th>Outstanding</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d?.items.map((t: TenantDetailRow) => (
              <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => void navigate({ to: "/tenants/$orgId", params: { orgId: t.orgId } })}>
                <td><div className="tenant-cell"><div className="avatar">{tenantInitials(t.name)}</div><div><b>{t.name}</b><small>{t.orgId}</small></div></div></td>
                <td>{t.industry ?? "-"}</td>
                <td>{t.country ?? "-"}</td>
                <td>{t.seatsUsed} / {t.seatLimit}</td>
                <td>{t.subscription ? <span className="badge">{t.subscription.plan}</span> : <span className="badge badge--ghost">No plan</span>}</td>
                <td><span className="badge"><span className={`dot dot--${t.subscription?.status === "ACTIVE" ? "ok" : t.subscription?.status === "TRIAL" ? "warn" : "muted"}`} />{t.subscription?.status ?? "None"}</span></td>
                <td>{t.subscription?.endDate ? fmtDate(t.subscription.endDate) : "-"}</td>
                <td>{t.procedures.total} <small style={{ color: "var(--text-3)" }}>({t.procedures.billable} bill.)</small></td>
                <td>{formatCurrency(t.billing.invoiced)}</td>
                <td className={parseFloat(t.billing.outstanding) > 0 ? "is-attention" : ""}>{formatCurrency(t.billing.outstanding)}</td>
                <td><button className="kebab" onClick={(e) => { e.stopPropagation(); void navigate({ to: "/tenants/$orgId", params: { orgId: t.orgId } }); }}><MoreHorizontal20Regular /></button></td>
              </tr>
            )) ?? <tr><td colSpan={11} className="empty">Loading...</td></tr>}
          </tbody>
        </table>
      </div>
      {d && d.total > 5 && (
        <div className="drilldown__footer">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="drilldown__pager">Page {d.page} of {Math.ceil(d.total / d.limit)}</span>
          <button className="btn" disabled={page * 5 >= d.total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

function UsersDrilldown() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const status = statusFilter.join(",");
  const role = roleFilter.join(",");
  const users = useUsersSummary(search, status, "", role, page);
  const d = users.data;
  const handleStatusChange = useCallback((v: string[]) => { setStatusFilter(v); setPage(1); }, []);
  const handleRoleChange = useCallback((v: string[]) => { setRoleFilter(v); setPage(1); }, []);
  return (
    <div className="card drilldown">
      <div className="drilldown__head">
        <div>
          <div className="drilldown__title">All users across tenants</div>
          <div className="drilldown__subtitle">{d ? `${d.summary.total} total · ${d.summary.active} active · ${d.summary.inactive} inactive` : "Loading..."}</div>
        </div>
      </div>
      {d && (
        <div className="drilldown__kpis">
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{d.summary.total}</div><div className="drilldown__kpi-label">Total</div></div>
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{d.summary.active}</div><div className="drilldown__kpi-label">Active</div></div>
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{d.summary.inactive}</div><div className="drilldown__kpi-label">Inactive</div></div>
          {d.summary.byRole.map((r) => (
            <div key={r.role} className="drilldown__kpi"><div className="drilldown__kpi-value">{r.count}</div><div className="drilldown__kpi-label">{r.role}</div></div>
          ))}
        </div>
      )}
      <div className="drilldown__filters">
        <input placeholder="Search by name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <MultiSelect
          placeholder="All statuses"
          options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]}
          value={statusFilter}
          onChange={handleStatusChange}
        />
        <MultiSelect
          placeholder="All roles"
          options={[{ value: "TENANT_ADMIN", label: "Tenant Admin" }, { value: "TENANT_USER", label: "Tenant User" }]}
          value={roleFilter}
          onChange={handleRoleChange}
        />
      </div>
      <div className="drilldown__body table-card">
        {d && <div className="table-card__head"><span className="table-count">{d.total} records</span></div>}
        <table className="table">
          <thead><tr><th>User</th><th>Email</th><th>Tenant</th><th>Role</th><th>Status</th><th>Last login</th></tr></thead>
          <tbody>
            {d?.items.map((u) => (
              <tr key={u.userId} style={{ cursor: "pointer" }} onClick={() => void navigate({ to: "/tenants/$orgId", params: { orgId: u.tenantOrgId } })}>
                <td><b>{u.firstName ?? ""} {u.lastName ?? ""}</b></td>
                <td>{u.email}</td>
                <td>{u.tenantName}</td>
                <td><span className="badge">{u.role}</span></td>
                <td><span className="badge"><span className={`dot dot--${u.isActive ? "ok" : "muted"}`} />{u.isActive ? "Active" : "Inactive"}</span></td>
                <td>{fmtDate(u.lastLoginAt)}</td>
              </tr>
            )) ?? <tr><td colSpan={6} className="empty">Loading...</td></tr>}
          </tbody>
        </table>
      </div>
      {d && d.total > 10 && (
        <div className="drilldown__footer">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="drilldown__pager">Page {d.page} of {Math.ceil(d.total / d.limit)}</span>
          <button className="btn" disabled={page * 10 >= d.total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

function ProceduresDrilldown() {
  const navigate = useNavigate();
  const [search, _setSearch] = useState("");
  const [status, _setStatus] = useState("");
  const [page, _setPage] = useState(1);
  const procs = useProceduresSummary(search, status, "", "", page);
  const d = procs.data;
  return (
    <div className="card drilldown">
      <div className="drilldown__head"><div><div className="drilldown__title">Procedure usage across all tenants</div></div></div>
      {d && (
        <div className="drilldown__kpis">
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{d.summary.total}</div><div className="drilldown__kpi-label">Total</div></div>
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{d.summary.completed}</div><div className="drilldown__kpi-label">Completed</div></div>
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{d.summary.failed}</div><div className="drilldown__kpi-label">Failed</div></div>
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{d.summary.cancelled}</div><div className="drilldown__kpi-label">Cancelled</div></div>
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{d.summary.billable}</div><div className="drilldown__kpi-label">Billable</div></div>
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{d.summary.nonBillable}</div><div className="drilldown__kpi-label">Non-billable</div></div>
        </div>
      )}
      {d && d.byTenant.length > 0 && (
        <div className="drilldown__body table-card" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <table className="table">
            <thead><tr><th>Tenant</th><th>Total</th><th>Billable</th><th>Non-billable</th></tr></thead>
            <tbody>
              {d.byTenant.map((t) => (
                <tr key={t.tenantId} style={{ cursor: "pointer" }} onClick={() => void navigate({ to: "/tenants/$orgId", params: { orgId: t.orgId } })}>
                  <td><b>{t.tenantName}</b></td><td>{t.total}</td><td>{t.billable}</td><td>{t.nonBillable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d && d.byCategory.length > 0 && (
        <div className="drilldown__body table-card">
          <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: "13px", borderBottom: "1px solid var(--border-soft)" }}>By category</div>
          <table className="table">
            <thead><tr><th>Category</th><th>Total</th><th>Billable</th></tr></thead>
            <tbody>
              {d.byCategory.map((c) => <tr key={c.categoryId}><td>{c.categoryName}</td><td>{c.total}</td><td>{c.billable}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubscriptionsDrilldown() {
  const navigate = useNavigate();
  const subs = useSubscriptionsExpiry();
  const d = subs.data;
  const [filters, setFilters] = useState<string[]>([]);
  const items = d?.items.filter((s) => filters.length === 0 || filters.includes(s.status) || filters.includes(s.expiryStatus)) ?? [];
  return (
    <div className="card drilldown">
      <div className="drilldown__head"><div><div className="drilldown__title">All subscriptions</div><div className="drilldown__subtitle">{d ? `${d.items.length} subscriptions` : "Loading..."}</div></div></div>
      <div className="drilldown__filters">
        <MultiSelect
          placeholder="All statuses"
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "TRIAL", label: "Trial" },
            { value: "EXPIRING_SOON", label: "Expiring soon" },
            { value: "EXPIRED", label: "Expired" },
          ]}
          value={filters}
          onChange={setFilters}
        />
      </div>
      <div className="drilldown__body table-card">
        {d && <div className="table-card__head"><span className="table-count">{items.length} records</span></div>}
        <table className="table">
          <thead><tr><th>Tenant</th><th>Plan</th><th>Billing</th><th>Rate</th><th>Start</th><th>Expiry</th><th>Remaining</th><th>Auto-renew</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.tenantId} style={{ cursor: "pointer" }} onClick={() => void navigate({ to: "/tenants/$orgId", params: { orgId: s.orgId } })}>
                <td><b>{s.tenantName}</b></td>
                <td>{s.plan}</td>
                <td>{s.billingCycle}</td>
                <td>{formatCurrency(s.monthlyRate)}</td>
                <td>{fmtDate(s.startDate)}</td>
                <td>{fmtDate(s.endDate ?? s.trialEndsAt)}</td>
                <td>{s.remainingDays > 0 ? `${s.remainingDays} days` : <span style={{ color: "var(--bad)" }}>Expired</span>}</td>
                <td>{s.autoRenew ? "Yes" : "No"}</td>
                <td><span className="badge"><span className={`dot dot--${s.expiryStatus === "EXPIRING_SOON" ? "warn" : s.status === "ACTIVE" ? "ok" : s.status === "TRIAL" ? "warn" : "muted"}`} />{s.expiryStatus === "EXPIRING_SOON" ? "Expiring soon" : s.status}</span></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={9} className="empty">No subscriptions match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutstandingDrilldown() {
  const navigate = useNavigate();
  const outs = useOutstandingDetail();
  const d = outs.data;
  return (
    <div className="card drilldown">
      <div className="drilldown__head"><div><div className="drilldown__title">Outstanding invoices</div><div className="drilldown__subtitle">{d ? `${d.total} unpaid invoices · ${formatCurrency(d.totalOutstanding)} outstanding` : "Loading..."}</div></div></div>
      <div className="drilldown__body table-card">
        {d && <div className="table-card__head"><span className="table-count">{d.total} records</span></div>}
        <table className="table">
          <thead><tr><th>Invoice</th><th>Tenant</th><th>Total</th><th>Outstanding</th><th>Due</th><th>Overdue</th><th>Status</th></tr></thead>
          <tbody>
            {d?.items.map((inv) => (
              <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => void navigate({ to: "/tenants/$orgId", params: { orgId: inv.tenantOrgId } })}>
                <td><b>{inv.invoiceNumber}</b></td>
                <td>{inv.tenantName}</td>
                <td>{formatCurrency(inv.total)}</td>
                <td style={{ color: "var(--bad)" }}>{formatCurrency(inv.outstanding)}</td>
                <td>{fmtDate(inv.dueDate)}</td>
                <td>{inv.overdueDays > 0 ? <span style={{ color: "var(--bad)" }}>{inv.overdueDays} days</span> : "-"}</td>
                <td><span className="badge"><span className={`dot dot--${inv.status === "OVERDUE" ? "bad" : "warn"}`} />{inv.status}</span></td>
              </tr>
            )) ?? <tr><td colSpan={7} className="empty">Loading...</td></tr>}
            {d && d.items.length === 0 && <tr><td colSpan={7} className="empty">No outstanding invoices.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentsDrilldown({ statusFilter }: { statusFilter: string }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const payments = usePaymentsDetail(search, statusFilter, "", page);
  const d = payments.data;
  const title = statusFilter === "PENDING" ? "Pending payments" : statusFilter === "FAILED" ? "Failed payments" : "Payment transactions";
  return (
    <div className="card drilldown">
      <div className="drilldown__head"><div><div className="drilldown__title">{title}</div><div className="drilldown__subtitle">{d ? `${d.total} transactions` : "Loading..."}</div></div></div>
      {d && (
        <div className="drilldown__kpis">
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{formatCurrency(d.summary.totalCollected)}</div><div className="drilldown__kpi-label">Collected</div></div>
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{formatCurrency(d.summary.totalPending)}</div><div className="drilldown__kpi-label">Pending</div></div>
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{formatCurrency(d.summary.totalFailed)}</div><div className="drilldown__kpi-label">Failed</div></div>
          <div className="drilldown__kpi"><div className="drilldown__kpi-value">{formatCurrency(d.summary.totalRefunded)}</div><div className="drilldown__kpi-label">Refunded</div></div>
        </div>
      )}
      <div className="drilldown__filters">
        <input placeholder="Search tenant..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <div className="drilldown__body table-card">
        {d && <div className="table-card__head"><span className="table-count">{d.total} records</span></div>}
        <table className="table">
          <thead><tr><th>Date</th><th>Tenant</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Status</th><th>Transaction</th></tr></thead>
          <tbody>
            {d?.items.map((p) => (
              <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => void navigate({ to: "/tenants/$orgId", params: { orgId: p.tenantOrgId } })}>
                <td>{fmtDate(p.paidAt ?? p.createdAt)}</td>
                <td><b>{p.tenantName}</b></td>
                <td>{p.invoiceNumber ?? "-"}</td>
                <td>{formatCurrency(p.amount)}</td>
                <td>{p.paymentMethod ?? "-"}</td>
                <td><span className="badge"><span className={`dot dot--${p.status === "PAID" ? "ok" : p.status === "FAILED" ? "bad" : "warn"}`} />{p.status}</span></td>
                <td style={{ fontSize: "12px", color: "var(--text-3)" }}>{p.transactionId ?? "-"}</td>
              </tr>
            )) ?? <tr><td colSpan={7} className="empty">Loading...</td></tr>}
          </tbody>
        </table>
      </div>
      {d && d.total > 10 && (
        <div className="drilldown__footer">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="drilldown__pager">Page {d.page} of {Math.ceil(d.total / d.limit)}</span>
          <button className="btn" disabled={page * 10 >= d.total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function PlatformPageContent() {
  const navigate = useNavigate();
  const summary = useDashboardSummary();
  const tenants = useTenantsDetail("", "", 1, "name", "asc");
  const subs = useSubscriptionsExpiry();
  const [drill, setDrill] = useState<DrillType>(null);

  const d = summary.data;
  const tData = tenants.data;
  const subData = subs.data;

  const toggleDrill = (type: DrillType) => setDrill((prev) => prev === type ? null : type);

  if (summary.isError || tenants.isError) {
    return (
      <div>
        <div className="page-head"><div><h1>Platform Dashboard</h1><p>Could not load dashboard data.</p></div></div>
        <button className="btn btn--primary" onClick={() => { void summary.refetch(); void tenants.refetch(); }}>Try again</button>
      </div>
    );
  }

  const attentionItems: { icon: React.ReactNode; title: React.ReactNode; description: string; urgent?: boolean; onClick?: () => void }[] = [];
  if (d && d.payments.pending > 0) {
    attentionItems.push({ icon: <Payment20Regular />, title: `${d.payments.pending} payment${d.payments.pending > 1 ? "s" : ""} pending`, description: "Awaiting confirmation from the payment gateway", onClick: () => toggleDrill("pending") });
  }
  if (subData) {
    for (const sub of subData.items) {
      if (sub.expiryStatus === "EXPIRING_SOON") {
        attentionItems.push({
          icon: <span style={{ fontSize: 12, fontWeight: 700, color: "var(--bad)" }}>{sub.remainingDays}d</span>,
          title: <><span style={{ color: "var(--bad)" }}>{sub.tenantName}</span> trial ends in {sub.remainingDays} days</>,
          description: `${sub.plan} / ${sub.billingCycle} -- reach out before it lapses`,
          urgent: true,
          onClick: () => void navigate({ to: "/tenants/$orgId", params: { orgId: sub.orgId } }),
        });
      }
    }
  }
  if (tData) {
    for (const t of tData.items) {
      if (!t.subscription) {
        attentionItems.push({ icon: <CubeTree20Regular />, title: `${t.name} has no plan`, description: "Assign a subscription plan to start billing", onClick: () => void navigate({ to: "/tenants/$orgId", params: { orgId: t.orgId } }) });
      }
    }
  }

  const subStatusItems = subData?.items ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Platform Dashboard</h1>
          <p>Click any number to see where it comes from.</p>
        </div>
        <div className="page-head__actions">
          <button className="btn"><Calendar20Regular /> Last 30 days</button>
          <button className="btn"><ArrowDownload20Regular /> Export</button>
          <button className="btn btn--primary"><Add20Regular /> Add Tenant</button>
        </div>
      </div>

      <div className="dash">
        <div className="dash__main">
          {/* KPI Cards */}
          {d ? (
            <div className="dash__kpis">
              <div className={`card kpi${drill === "tenants" ? " is-selected" : ""}`} onClick={() => toggleDrill("tenants")}>
                <div className="kpi__head"><span className="kpi__label">Total Tenants</span><span className="kpi__icon"><Building20Regular /></span></div>
                <div className="kpi__value">{d.tenants.total}</div>
                <div className="kpi__hint">{d.tenants.active} active, {d.tenants.inactive} inactive</div>
              </div>
              <div className={`card kpi${drill === "users" ? " is-selected" : ""}`} onClick={() => toggleDrill("users")}>
                <div className="kpi__head"><span className="kpi__label">Total Users</span><span className="kpi__icon"><People20Regular /></span></div>
                <div className="kpi__value">{d.users.total}</div>
                <div className="kpi__hint">Across all tenants</div>
              </div>
              <div className={`card kpi${drill === "collected" ? " is-selected" : ""}`} onClick={() => toggleDrill("collected")}>
                <div className="kpi__head"><span className="kpi__label">Collected</span><span className="kpi__icon"><Money20Regular /></span></div>
                <div className="kpi__value">{formatCurrency(d.revenue.totalCollected)}</div>
                <div className="kpi__hint">All-time payments received</div>
              </div>
              <div className={`card kpi${drill === "subscriptions" ? " is-selected" : ""}`} onClick={() => toggleDrill("subscriptions")}>
                <div className="kpi__head"><span className="kpi__label">Active Subscriptions</span><span className="kpi__icon"><CheckmarkCircle20Regular /></span></div>
                <div className="kpi__value">{d.subscriptions.active}</div>
                <div className="kpi__hint">{d.subscriptions.trial} on trial</div>
              </div>
            </div>
          ) : (
            <div className="dash__kpis">
              {[1, 2, 3, 4].map((i) => <div key={i} className="card kpi" style={{ minHeight: 110 }}><div className="kpi__hint">Loading...</div></div>)}
            </div>
          )}

          {/* Summary cards */}
          {d && (
            <div className="dash__summary">
              <div className={`card kpi${drill === "procedures" ? " is-selected" : ""}`} onClick={() => toggleDrill("procedures")}>
                <div className="kpi__head"><span className="kpi__label">Total Procedures</span><span className="kpi__icon"><ArrowTrending20Regular /></span></div>
                <div className="kpi__value">{d.procedures.total}</div>
                <div className="kpi__hint">{d.procedures.billable} billable, {d.procedures.nonBillable} non-billable</div>
              </div>
              <div className={`card kpi${drill === "collected" ? " is-selected" : ""}`} onClick={() => toggleDrill("collected")}>
                <div className="kpi__head"><span className="kpi__label">Total Revenue</span><span className="kpi__icon"><Receipt20Regular /></span></div>
                <div className="kpi__value">{formatCurrency(d.revenue.totalInvoiced)}</div>
                <div className="kpi__hint">All-time invoiced amount</div>
              </div>
              <div className={`card kpi${drill === "outstanding" ? " is-selected" : ""}`} onClick={() => toggleDrill("outstanding")}>
                <div className="kpi__head"><span className="kpi__label">Outstanding</span><span className="kpi__icon"><MoneyOff20Regular /></span></div>
                <div className={`kpi__value${parseFloat(d.revenue.totalOutstanding) > 0 ? " is-attention" : ""}`}>{formatCurrency(d.revenue.totalOutstanding)}</div>
                <div className="kpi__hint">Unpaid invoice balance</div>
              </div>
              <div className="card kpi">
                <div className="kpi__head"><span className="kpi__label">Refunded</span><span className="kpi__icon"><Dismiss20Regular /></span></div>
                <div className="kpi__value">{formatCurrency(d.revenue.totalRefunded)}</div>
                <div className="kpi__hint">Total refunds issued</div>
              </div>
              <div className={`card kpi${drill === "subscriptions" ? " is-selected" : ""}`} onClick={() => toggleDrill("subscriptions")}>
                <div className="kpi__head"><span className="kpi__label">Expiring Soon</span><span className="kpi__icon"><Timer20Regular /></span></div>
                <div className={`kpi__value${d.subscriptions.expiringSoon > 0 ? " is-attention" : ""}`}>{d.subscriptions.expiringSoon}</div>
                <div className="kpi__hint">Subscriptions nearing expiry</div>
              </div>
              <div className={`card kpi${drill === "subscriptions" ? " is-selected" : ""}`} onClick={() => toggleDrill("subscriptions")}>
                <div className="kpi__head"><span className="kpi__label">Expired</span><span className="kpi__icon"><CalendarCancel20Regular /></span></div>
                <div className={`kpi__value${d.subscriptions.expired > 0 ? " is-attention" : ""}`}>{d.subscriptions.expired}</div>
                <div className="kpi__hint">Lapsed subscriptions</div>
              </div>
              <div className={`card kpi${drill === "pending" ? " is-selected" : ""}`} onClick={() => toggleDrill("pending")}>
                <div className="kpi__head"><span className="kpi__label">Pending Payments</span><span className="kpi__icon"><Payment20Regular /></span></div>
                <div className={`kpi__value${d.payments.pending > 0 ? " is-attention" : ""}`}>{d.payments.pending}</div>
                <div className="kpi__hint">Awaiting confirmation</div>
              </div>
              <div className={`card kpi${drill === "failed" ? " is-selected" : ""}`} onClick={() => toggleDrill("failed")}>
                <div className="kpi__head"><span className="kpi__label">Failed Payments</span><span className="kpi__icon"><ErrorCircle20Regular /></span></div>
                <div className={`kpi__value${d.payments.failed > 0 ? " is-attention" : ""}`}>{d.payments.failed}</div>
                <div className="kpi__hint">Requires attention</div>
              </div>
            </div>
          )}

          {/* All drill-downs appear below all summary cards */}
          {drill === "collected" && <CollectedDrilldown />}
          {drill === "tenants" && <TenantsDrilldown />}
          {drill === "users" && <UsersDrilldown />}
          {drill === "subscriptions" && <SubscriptionsDrilldown />}
          {drill === "procedures" && <ProceduresDrilldown />}
          {drill === "outstanding" && <OutstandingDrilldown />}
          {drill === "pending" && <PaymentsDrilldown statusFilter="PENDING" />}
          {drill === "failed" && <PaymentsDrilldown statusFilter="FAILED" />}

          {/* Tenants table (when no drill-down active or always visible) */}
          {!drill && (
            <div className="dash__tenants">
              <div className="section__head">
                <div className="section__title"><span className="icon"><Building20Regular /></span>Tenants{tData && <span className="count">{tData.total}</span>}</div>
                <button className="link" onClick={() => void navigate({ to: "/tenants" })}>View all <ChevronRight16Regular /></button>
              </div>
              <div className="card table-card">
                {tData && <div className="table-card__head"><span className="table-count">{tData.total} records</span></div>}
                <table className="table">
                  <thead>
                    <tr><th>Tenant</th><th>Industry</th><th className="col-country">Country</th><th>Plan</th><th>Status</th><th className="table__actions" /></tr>
                  </thead>
                  <tbody>
                    {tData?.items.map((t: TenantDetailRow) => (
                      <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => void navigate({ to: "/tenants/$orgId", params: { orgId: t.orgId } })}>
                        <td><div className="tenant-cell"><div className="avatar">{tenantInitials(t.name)}</div><div><b>{t.name}</b><small>{t.orgId}</small></div></div></td>
                        <td>{t.industry ?? "-"}</td>
                        <td className="col-country">{t.country ?? "-"}</td>
                        <td>{t.subscription ? <span className="badge">{t.subscription.plan}</span> : <span className="badge badge--ghost">No plan</span>}</td>
                        <td>
                          {(() => {
                            const exp = isExpiringSoon(t.subscription);
                            if (exp.expiring) {
                              return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--bad)", fontSize: 13, fontWeight: 600 }}><Timer20Regular style={{ fontSize: 16 }} />{exp.days <= 0 ? "Expired" : `Expires in ${exp.days}d`}</span>;
                            }
                            return <span className="badge"><span className={`dot dot--${t.subscription?.status === "ACTIVE" ? "ok" : t.subscription?.status === "TRIAL" ? "warn" : "muted"}`} />{t.subscription?.status === "ACTIVE" ? "Active" : t.subscription?.status === "TRIAL" ? "Trial" : t.status}</span>;
                          })()}
                        </td>
                        <td><TenantKebab orgId={t.orgId} /></td>
                      </tr>
                    )) ?? <tr><td colSpan={6} className="empty">Loading tenants...</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="dash__rail">
          <div className="dash__attention card">
            <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="section__title"><span className="icon"><Warning20Regular /></span>Needs attention<span className="count">{attentionItems.length}</span></div>
            </div>
            {attentionItems.length === 0 ? (
              <div className="empty">Everything looks good.</div>
            ) : (
              attentionItems.map((item, i) => (
                <div key={i} className={`attention${item.urgent ? " attention--urgent" : ""}`} onClick={item.onClick} role={item.onClick ? "button" : undefined} tabIndex={item.onClick ? 0 : undefined}><div className="attention__icon">{item.icon}</div><div className="attention__text"><b>{item.title}</b><small>{item.description}</small></div></div>
              ))
            )}
          </div>

          <div className="dash__subs card">
            <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="section__title"><span className="icon"><CheckmarkCircle20Regular /></span>Subscription status<span className="count">{subStatusItems.length}</span></div>
              <button className="link" onClick={() => void navigate({ to: "/subscription" })}>View all <ChevronRight16Regular /></button>
            </div>
            {subStatusItems.length === 0 ? (
              <div className="empty">No subscriptions.</div>
            ) : (
              subStatusItems.map((sub) => (
                <div key={sub.tenantId} className="subscription">
                  <div><b>{sub.tenantName}</b><small>{sub.plan} / {sub.billingCycle}</small></div>
                  <span className="badge"><span className={`dot dot--${sub.expiryStatus === "EXPIRING_SOON" ? "warn" : sub.status === "ACTIVE" ? "ok" : sub.status === "TRIAL" ? "warn" : "muted"}`} />{sub.expiryStatus === "EXPIRING_SOON" ? "Expiring soon" : sub.status === "ACTIVE" ? "Active" : sub.status === "TRIAL" ? "Trial" : sub.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function PlatformPage() {
  return (
    <RequireRoles roles={["SUPER_ADMIN"]}>
      <PlatformPageContent />
    </RequireRoles>
  );
}

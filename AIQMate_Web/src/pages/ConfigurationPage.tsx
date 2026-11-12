// SPEC-039 US-003 / US-004. The Org Admin's own organisation: its industry pack (read-only, set by
// San-Tech), its names for each module, which modules are on and in what order, and custom fields.

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { Add24Regular, ArrowDown24Regular, ArrowUp24Regular, Edit24Regular } from "@fluentui/react-icons";
import { useMemo, useState, type FormEvent } from "react";
import { ErrorPanel, LoadingTiles, PageHeader, usePanelStyles } from "@/components/Panels";
import { RequireRoles } from "@/components/RequireRoles";
import {
  FIELD_KINDS,
  FIELD_KIND_LABEL,
  metadataErrorMessage,
  useAllFields,
  useFieldMutations,
  useOrgMetadata,
  useResetModules,
  useSaveModules,
  type CustomFieldDto,
  type EffectiveMetadata,
  type FieldKind,
  type ModuleInput,
} from "@/lib/api/metadata";
import { useSession } from "@/lib/auth/session";
import { FIELD_KEY_RE, keyFromLabel, parseOptions } from "@/lib/customFields";
import { FIELD_MODULES, MODULE_REGISTRY, type ModuleKey } from "@/lib/modules";

const MAX_NAME = 40;
const MAX_ACTIVE_FIELDS = 20;

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  orderCell: { display: "flex", gap: tokens.spacingHorizontalXXS },
  nameInput: { minWidth: "140px", width: "100%" },
  muted: { color: tokens.colorNeutralForeground3, overflowWrap: "anywhere" },
  wrap: { overflowWrap: "anywhere" },
  moduleSelect: { maxWidth: "320px" },
  badges: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
});

/** The editable rows, in display order; `order` is re-numbered from the position on save. */
function rowsFrom(meta: EffectiveMetadata): ModuleInput[] {
  return [...meta.modules]
    .sort((a, b) => a.order - b.order)
    .map((m) => ({ key: m.key, enabled: m.enabled, order: m.order, singular: m.singular, plural: m.plural }));
}

/** US-003 AC-1: every row is sent, with its position as the order. */
export function modulesPayload(rows: ModuleInput[]): ModuleInput[] {
  return rows.map((r, i) => ({ ...r, singular: r.singular.trim(), plural: r.plural.trim(), order: i + 1 }));
}

/** FR-MD-007 and US-003 AC-3, checked before sending. */
export function modulesProblem(rows: ModuleInput[]): string | null {
  if (!rows.some((r) => r.enabled)) return "Keep at least one module switched on.";
  for (const r of rows) {
    const label = MODULE_REGISTRY[r.key].plural;
    if (!r.singular.trim() || !r.plural.trim()) return `${label}: both names are needed.`;
    if (r.singular.trim().length > MAX_NAME || r.plural.trim().length > MAX_NAME) return `${label}: use ${MAX_NAME} characters or fewer.`;
  }
  return null;
}

function PackCard({ meta }: { meta: EffectiveMetadata }) {
  const p = usePanelStyles();
  const s = useStyles();
  return (
    <Card className={p.card}>
      <Text as="h2" size={500} weight="semibold">
        Industry pack
      </Text>
      <Text weight="semibold" className={s.wrap}>
        {meta.pack.name}
      </Text>
      <Text className={s.muted}>Set by San-Tech when your organisation was set up. Your changes below apply on top of it.</Text>
    </Card>
  );
}

function ModulesCard({ meta }: { meta: EffectiveMetadata }) {
  const p = usePanelStyles();
  const s = useStyles();
  const session = useSession();
  const save = useSaveModules(session.user.id);
  const reset = useResetModules(session.user.id);
  const [rows, setRows] = useState<ModuleInput[]>(() => rowsFrom(meta));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const byKey = useMemo(() => new Map(meta.modules.map((m) => [m.key, m])), [meta]);

  const update = (i: number, patch: Partial<ModuleInput>) => {
    setSaved(false);
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  const move = (i: number, by: -1 | 1) => {
    setSaved(false);
    setRows((rs) => {
      const j = i + by;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const problem = modulesProblem(rows);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const data = await save.mutateAsync(modulesPayload(rows));
      setRows(rowsFrom(data));
      setSaved(true);
    } catch (err) {
      setError(metadataErrorMessage(err));
    }
  }

  async function doReset() {
    setError(null);
    try {
      const data = await reset.mutateAsync();
      setRows(rowsFrom(data));
      setConfirmReset(false);
      setSaved(true);
    } catch (err) {
      setConfirmReset(false);
      setError(metadataErrorMessage(err, "The names could not be reset. Try again."));
    }
  }

  return (
    <Card className={p.card}>
      <Text as="h2" size={500} weight="semibold">
        Modules
      </Text>
      <Text className={s.muted}>
        The names your people see in the menu and on pages, which modules are on, and their order. Names change on the portal now and on the mobile app in a later release.
      </Text>
      <form className={s.form} onSubmit={submit} noValidate aria-label="Modules">
        {error && (
          <MessageBar intent="error" layout="multiline">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
        <div className={p.scroll}>
          <Table aria-label="Modules" size="medium" className={mergeClasses(p.table, p.tableWidest)}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Module</TableHeaderCell>
                <TableHeaderCell>On</TableHeaderCell>
                <TableHeaderCell>Order</TableHeaderCell>
                <TableHeaderCell>Name for one</TableHeaderCell>
                <TableHeaderCell>Name for many</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const std = MODULE_REGISTRY[r.key];
                return (
                  <TableRow key={r.key}>
                    <TableCell className={s.wrap}>{std.plural}</TableCell>
                    <TableCell>
                      <Switch checked={r.enabled} aria-label={`${std.plural} on`} onChange={(_, d) => update(i, { enabled: d.checked })} />
                    </TableCell>
                    <TableCell>
                      <span className={s.orderCell}>
                        <Button size="small" appearance="subtle" icon={<ArrowUp24Regular />} aria-label={`Move ${std.plural} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                        <Button size="small" appearance="subtle" icon={<ArrowDown24Regular />} aria-label={`Move ${std.plural} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} />
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input className={s.nameInput} value={r.singular} maxLength={MAX_NAME} aria-label={`${std.plural}, name for one`} placeholder={std.singular} onChange={(_, d) => update(i, { singular: d.value })} />
                    </TableCell>
                    <TableCell>
                      <Input className={s.nameInput} value={r.plural} maxLength={MAX_NAME} aria-label={`${std.plural}, name for many`} placeholder={std.plural} onChange={(_, d) => update(i, { plural: d.value })} />
                    </TableCell>
                    <TableCell>
                      {byKey.get(r.key)?.customised ? (
                        <Badge className={p.nowrap} appearance="tint" color="brand">
                          Customised
                        </Badge>
                      ) : (
                        <Text className={mergeClasses(s.muted, p.nowrap)}>Pack default</Text>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className={s.actions}>
          <Button appearance="primary" type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving" : "Save"}
          </Button>
          <Button onClick={() => setConfirmReset(true)} disabled={reset.isPending}>
            Reset to pack defaults
          </Button>
          {saved && <Text className={s.muted}>Saved.</Text>}
        </div>
      </form>

      <Dialog open={confirmReset} onOpenChange={(_, d) => setConfirmReset(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Reset to pack defaults?</DialogTitle>
            <DialogContent>
              Every module goes back to the name, on or off setting and order of the {meta.pack.name} pack. Custom fields are not changed.
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button appearance="primary" onClick={() => void doReset()} disabled={reset.isPending}>
                {reset.isPending ? "Resetting" : "Reset"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Card>
  );
}

interface FieldFormValue {
  label: string;
  key: string;
  kind: FieldKind;
  required: boolean;
  options: string;
  helpText: string;
}

/** FR-MD-008, checked before sending. */
export function fieldProblem(v: FieldFormValue): string | null {
  if (!v.label.trim() || v.label.trim().length > 60) return "Enter a label of 60 characters or fewer.";
  if (!FIELD_KEY_RE.test(v.key)) return "The key starts with a lower-case letter and uses only lower-case letters, numbers and _ (2 to 40 characters).";
  if (v.helpText.trim().length > 160) return "Keep the help text to 160 characters or fewer.";
  if (v.kind === "CHOICE") {
    const opts = parseOptions(v.options);
    if (opts.length < 2 || opts.length > 30) return "A choice needs 2 to 30 options, one per line.";
    if (opts.some((o) => o.length > 60)) return "Each option must be 60 characters or fewer.";
  }
  return null;
}

function FieldDialog({
  moduleKey,
  editing,
  nextOrder,
  onClose,
}: {
  moduleKey: ModuleKey;
  editing: CustomFieldDto | null;
  nextOrder: number;
  onClose: () => void;
}) {
  const s = useStyles();
  const session = useSession();
  const api = useFieldMutations(session.user.id);
  const [value, setValue] = useState<FieldFormValue>(() =>
    editing
      ? { label: editing.label, key: editing.key, kind: editing.kind, required: editing.required, options: editing.options.join("\n"), helpText: editing.helpText ?? "" }
      : { label: "", key: "", kind: "TEXT", required: false, options: "", helpText: "" },
  );
  const [keyTouched, setKeyTouched] = useState(editing !== null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = fieldProblem(value);
    if (problem) {
      setError(problem);
      return;
    }
    const options = value.kind === "CHOICE" ? parseOptions(value.options) : [];
    const helpText = value.helpText.trim() || null;
    setBusy(true);
    try {
      if (editing) {
        await api.update(editing.id, { label: value.label.trim(), required: value.required, options, helpText, order: editing.order });
      } else {
        await api.create({ moduleKey, key: value.key, label: value.label.trim(), kind: value.kind, required: value.required, options, helpText });
      }
      onClose();
    } catch (err) {
      setError(metadataErrorMessage(err, "The field could not be saved. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <form onSubmit={submit} noValidate>
          <DialogBody>
            <DialogTitle>{editing ? "Edit field" : `Add a field to ${MODULE_REGISTRY[moduleKey].plural}`}</DialogTitle>
            <DialogContent className={s.form}>
              {error && (
                <MessageBar intent="error" layout="multiline">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
              <Field label="Label" required>
                <Input
                  value={value.label}
                  maxLength={60}
                  placeholder="Name of the field people see"
                  onChange={(_, d) => setValue((v) => ({ ...v, label: d.value, key: keyTouched ? v.key : keyFromLabel(d.value) }))}
                />
              </Field>
              <Field label="Key" required hint={editing ? "The key cannot be changed." : "Used by the API and exports. It cannot be changed later."}>
                <Input
                  value={value.key}
                  maxLength={40}
                  disabled={editing !== null}
                  placeholder="Lower-case key with letters, numbers and _"
                  onChange={(_, d) => {
                    setKeyTouched(true);
                    setValue((v) => ({ ...v, key: d.value }));
                  }}
                />
              </Field>
              <Field label="Kind" required hint={editing ? "The kind cannot be changed." : undefined}>
                <Select value={value.kind} disabled={editing !== null} onChange={(_, d) => setValue((v) => ({ ...v, kind: d.value as FieldKind }))}>
                  {FIELD_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {FIELD_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              {value.kind === "CHOICE" && (
                <Field label="Options" required hint="One option per line, 2 to 30 options.">
                  <Textarea value={value.options} rows={5} placeholder="Options, one per line" onChange={(_, d) => setValue((v) => ({ ...v, options: d.value }))} />
                </Field>
              )}
              <Field label="Help text">
                <Input value={value.helpText} maxLength={160} placeholder="A short hint shown under the field" onChange={(_, d) => setValue((v) => ({ ...v, helpText: d.value }))} />
              </Field>
              <Checkbox checked={value.required} label="Required" onChange={(_, d) => setValue((v) => ({ ...v, required: d.checked === true }))} />
              {!editing && <Text className={s.muted}>It is added last, position {nextOrder}.</Text>}
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button appearance="primary" type="submit" disabled={busy}>
                {busy ? "Saving" : editing ? "Save" : "Add field"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

function FieldsCard() {
  const p = usePanelStyles();
  const s = useStyles();
  const session = useSession();
  const all = useAllFields(session.user.id);
  const api = useFieldMutations(session.user.id);
  const [moduleKey, setModuleKey] = useState<ModuleKey>(FIELD_MODULES[0]);
  const [dialog, setDialog] = useState<{ editing: CustomFieldDto | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fields = (all.data ?? []).filter((f) => f.moduleKey === moduleKey).sort((a, b) => a.order - b.order);
  const activeCount = fields.filter((f) => !f.archivedAt).length;

  async function toggle(f: CustomFieldDto) {
    setError(null);
    try {
      if (f.archivedAt) await api.restore(f.id);
      else await api.archive(f.id);
    } catch (err) {
      setError(metadataErrorMessage(err));
    }
  }

  return (
    <Card className={p.card}>
      <div className={p.cardHead}>
        <Text as="h2" size={500} weight="semibold">
          Custom fields
        </Text>
        <Button icon={<Add24Regular />} onClick={() => setDialog({ editing: null })} disabled={activeCount >= MAX_ACTIVE_FIELDS || !all.data}>
          Add field
        </Button>
      </div>
      <Text className={s.muted}>Extra details your people record on each item. Up to {MAX_ACTIVE_FIELDS} active fields per module. Archived fields keep their values.</Text>
      <Field label="Module" className={s.moduleSelect}>
        <Select value={moduleKey} onChange={(_, d) => setModuleKey(d.value as ModuleKey)}>
          {FIELD_MODULES.map((k) => (
            <option key={k} value={k}>
              {MODULE_REGISTRY[k].plural}
            </option>
          ))}
        </Select>
      </Field>
      {error && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {all.isError ? (
        <ErrorPanel error={all.error} onRetry={() => void all.refetch()} />
      ) : !all.data ? (
        <LoadingTiles count={1} />
      ) : fields.length === 0 ? (
        <Text className={p.empty}>No custom fields for {MODULE_REGISTRY[moduleKey].plural.toLowerCase()} yet.</Text>
      ) : (
        <div className={p.scroll}>
          <Table aria-label="Custom fields" size="medium" className={mergeClasses(p.table, p.tableWide)}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Label</TableHeaderCell>
                <TableHeaderCell>Key</TableHeaderCell>
                <TableHeaderCell>Kind</TableHeaderCell>
                <TableHeaderCell>Required</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className={s.wrap}>{f.label}</TableCell>
                  <TableCell className={s.wrap}>{f.key}</TableCell>
                  <TableCell className={p.nowrap}>{FIELD_KIND_LABEL[f.kind] ?? f.kind}</TableCell>
                  <TableCell>{f.required ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <span className={s.badges}>
                      {f.archivedAt ? (
                        <Badge className={p.nowrap} appearance="outline" color="informative">
                          Archived
                        </Badge>
                      ) : (
                        <Badge className={p.nowrap} appearance="tint" color="success">
                          Active
                        </Badge>
                      )}
                      {f.source === "PACK" && (
                        <Badge className={p.nowrap} appearance="tint" color="informative">
                          From pack
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={s.actions}>
                      <Button size="small" icon={<Edit24Regular />} onClick={() => setDialog({ editing: f })} disabled={f.archivedAt !== null}>
                        Edit
                      </Button>
                      <Button size="small" onClick={() => void toggle(f)}>
                        {f.archivedAt ? "Restore" : "Archive"}
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {dialog && (
        <FieldDialog
          moduleKey={moduleKey}
          editing={dialog.editing}
          nextOrder={fields.length + 1}
          onClose={() => setDialog(null)}
        />
      )}
    </Card>
  );
}

function ConfigurationPageContent() {
  const p = usePanelStyles();
  const session = useSession();
  const meta = useOrgMetadata(session.user.id, session.roles);
  return (
    <div className={p.page}>
      <PageHeader title="Configuration" sub="Your organisation's names, modules and custom fields." />
      {meta.isError ? (
        <ErrorPanel error={meta.error} onRetry={() => void meta.refetch()} />
      ) : meta.data ? (
        <>
          <PackCard meta={meta.data} />
          <ModulesCard meta={meta.data} />
          <FieldsCard />
        </>
      ) : (
        <LoadingTiles count={2} />
      )}
    </div>
  );
}

/** Gate first, so a role that may not open this page never sends its requests. */
export function ConfigurationPage() {
  return (
    <RequireRoles roles={["ORG_ADMIN"]}>
      <ConfigurationPageContent />
    </RequireRoles>
  );
}

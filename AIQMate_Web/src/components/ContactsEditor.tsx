// SPEC-038 US-002 / US-006. List, add, edit and delete a company's points of contact. One component
// for the Super Admin's tenant page and the Org Admin's Company contacts page; the caller passes the
// matching mutations (ContactsApi).

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
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Skeleton,
  SkeletonItem,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Add24Regular, Delete24Regular, Edit24Regular } from "@fluentui/react-icons";
import { useState, type FormEvent } from "react";
import {
  CONTACT_TYPES,
  CONTACT_TYPE_LABEL,
  MAX_CONTACTS,
  cleanContactInput,
  contactErrorMessage,
  type Contact,
  type ContactInput,
  type ContactType,
  type ContactsApi,
} from "@/lib/api/contacts";
import { ErrorPanel } from "./Panels";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM, minWidth: 0 },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalM} 0`,
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  who: { flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  line: { color: tokens.colorNeutralForeground2, overflowWrap: "anywhere" },
  actions: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

const EMPTY: ContactInput = { name: "", title: "", email: "", phone: "", contactType: "PRIMARY" };

function ContactForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: ContactInput;
  onSubmit: (input: ContactInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const s = useStyles();
  const [value, setValue] = useState<ContactInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ContactInput) => (_: unknown, d: { value: string }) => setValue((v) => ({ ...v, [k]: d.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.name.trim() || !value.email.trim()) {
      setError("A name and an email are needed.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(cleanContactInput(value));
    } catch (err) {
      setError(contactErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate>
      {error && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <Field label="Name" required>
        <Input value={value.name} onChange={set("name")} placeholder="Full name of the contact" maxLength={120} />
      </Field>
      <Field label="Job title">
        <Input value={value.title ?? ""} onChange={set("title")} placeholder="Their role in the company" maxLength={120} />
      </Field>
      <Field label="Email" required>
        <Input type="email" value={value.email} onChange={set("email")} placeholder="Work email address" />
      </Field>
      <Field label="Phone">
        <Input type="tel" value={value.phone ?? ""} onChange={set("phone")} placeholder="Phone number with country code" maxLength={40} />
      </Field>
      <Field label="Contact type" required>
        <Select value={value.contactType} onChange={(_, d) => setValue((v) => ({ ...v, contactType: d.value as ContactType }))}>
          {CONTACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTACT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <DialogActions>
        <Button appearance="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button appearance="primary" type="submit" disabled={busy}>
          {busy ? "Saving" : submitLabel}
        </Button>
      </DialogActions>
    </form>
  );
}

type Mode = { kind: "closed" } | { kind: "add" } | { kind: "edit"; contact: Contact } | { kind: "delete"; contact: Contact };

export function ContactsEditor({
  title = "Points of contact",
  description,
  contacts,
  isLoading,
  error,
  onRetry,
  api,
}: {
  title?: string;
  description?: string;
  contacts: Contact[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  api: ContactsApi;
}) {
  const s = useStyles();
  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const list = contacts ?? [];
  const full = list.length >= MAX_CONTACTS;
  const close = () => {
    setMode({ kind: "closed" });
    setDeleteError(null);
  };

  async function confirmDelete(contact: Contact) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.remove(contact.id);
      close();
    } catch (err) {
      setDeleteError(contactErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className={s.card}>
      <div className={s.head}>
        <Text as="h2" size={500} weight="semibold">
          {title}
        </Text>
        <Button icon={<Add24Regular />} onClick={() => setMode({ kind: "add" })} disabled={full || isLoading || !!error}>
          Add contact
        </Button>
      </div>
      {description && <Text className={s.line}>{description}</Text>}
      {full && <Text size={200} className={s.muted}>A company can have at most 3 contacts.</Text>}

      {error ? (
        <ErrorPanel error={error} onRetry={onRetry} />
      ) : isLoading ? (
        <Skeleton aria-label="Loading">
          <SkeletonItem shape="rectangle" size={40} />
          <SkeletonItem shape="rectangle" size={40} style={{ marginTop: 8 }} />
        </Skeleton>
      ) : list.length === 0 ? (
        <Text className={s.muted}>No contacts yet. Add 2 to 3 people.</Text>
      ) : (
        <ul className={s.list}>
          {list.map((c) => (
            <li key={c.id} className={s.row}>
              <div className={s.who}>
                <Text weight="semibold" style={{ overflowWrap: "anywhere" }}>
                  {c.name}{" "}
                  <Badge appearance="tint" color={c.contactType === "PRIMARY" ? "brand" : "informative"}>
                    {CONTACT_TYPE_LABEL[c.contactType]}
                  </Badge>
                </Text>
                {c.title && <Text className={s.line}>{c.title}</Text>}
                <Text className={s.line}>{c.email}</Text>
                {c.phone && <Text className={s.line}>{c.phone}</Text>}
              </div>
              <div className={s.actions}>
                <Button icon={<Edit24Regular />} appearance="subtle" onClick={() => setMode({ kind: "edit", contact: c })}>
                  Edit
                </Button>
                <Button icon={<Delete24Regular />} appearance="subtle" onClick={() => setMode({ kind: "delete", contact: c })}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={mode.kind === "add" || mode.kind === "edit"} onOpenChange={(_, d) => !d.open && close()}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{mode.kind === "edit" ? "Edit contact" : "Add contact"}</DialogTitle>
            <DialogContent>
              {(mode.kind === "add" || mode.kind === "edit") && (
                <ContactForm
                  key={mode.kind === "edit" ? mode.contact.id : "new"}
                  initial={
                    mode.kind === "edit"
                      ? {
                          name: mode.contact.name,
                          title: mode.contact.title ?? "",
                          email: mode.contact.email,
                          phone: mode.contact.phone ?? "",
                          contactType: mode.contact.contactType,
                        }
                      : { ...EMPTY, contactType: list.some((c) => c.contactType === "PRIMARY") ? "OTHER" : "PRIMARY" }
                  }
                  submitLabel={mode.kind === "edit" ? "Save" : "Add"}
                  onCancel={close}
                  onSubmit={async (input) => {
                    if (mode.kind === "edit") await api.update(mode.contact.id, input);
                    else await api.create(input);
                    close();
                  }}
                />
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={mode.kind === "delete"} onOpenChange={(_, d) => !d.open && close()}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete contact</DialogTitle>
            <DialogContent>
              {deleteError && (
                <MessageBar intent="error" layout="multiline">
                  <MessageBarBody>{deleteError}</MessageBarBody>
                </MessageBar>
              )}
              <Text>
                {mode.kind === "delete" ? `Delete ${mode.contact.name}? This cannot be undone.` : null}
              </Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={close} disabled={deleting}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                disabled={deleting}
                onClick={() => mode.kind === "delete" && void confirmDelete(mode.contact)}
              >
                {deleting ? "Deleting" : "Delete"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Card>
  );
}

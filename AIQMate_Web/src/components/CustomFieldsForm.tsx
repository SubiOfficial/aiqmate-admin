// SPEC-039 US-005. A module's custom fields for one item: an editable form for Org Admins, Managers
// and Supervisors, read-only for Experts. The kinds are text, number, date, choice and yes/no.

import {
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Switch,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useState, type FormEvent } from "react";
import { metadataErrorMessage, type CustomFieldDto, type FieldValue } from "@/lib/api/metadata";
import { displayValue, toDraft, toPayload, type FieldDraft } from "@/lib/customFields";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  dl: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: tokens.spacingVerticalXS, margin: 0 },
  dt: { color: tokens.colorNeutralForeground2, margin: 0, overflowWrap: "anywhere" },
  dd: { margin: `0 0 ${tokens.spacingVerticalS} 0`, overflowWrap: "anywhere" },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
});

export function CustomFieldsForm({
  fields,
  values,
  readOnly,
  onSave,
}: {
  fields: CustomFieldDto[];
  values: Record<string, FieldValue>;
  readOnly: boolean;
  onSave: (values: Record<string, FieldValue | null>) => Promise<unknown>;
}) {
  const s = useStyles();
  const [draft, setDraft] = useState<FieldDraft>(() => toDraft(fields, values));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  if (fields.length === 0) {
    return <Text className={s.muted}>No custom fields for this module yet.</Text>;
  }

  if (readOnly) {
    return (
      <dl className={s.dl}>
        {fields.map((f) => (
          <div key={f.id} style={{ display: "contents" }}>
            <dt className={s.dt}>{f.label}</dt>
            <dd className={s.dd}>{displayValue(f, values[f.key])}</dd>
          </div>
        ))}
      </dl>
    );
  }

  const set = (key: string, v: string | boolean) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: v }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    const result = toPayload(fields, draft);
    setErrors(result.errors);
    if (Object.keys(result.errors).length > 0) return;
    setBusy(true);
    try {
      await onSave(result.values);
      setSaved(true);
    } catch (err) {
      setFormError(metadataErrorMessage(err, "The values could not be saved. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate aria-label="Custom fields">
      {formError && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>{formError}</MessageBarBody>
        </MessageBar>
      )}
      {fields.map((f) => {
        const v = draft[f.key];
        const common = {
          label: f.label,
          required: f.required,
          hint: f.helpText ?? undefined,
          validationMessage: errors[f.key],
          validationState: errors[f.key] ? ("error" as const) : ("none" as const),
        };
        switch (f.kind) {
          case "BOOLEAN":
            return (
              <Field key={f.id} {...common}>
                <Switch checked={v === true} onChange={(_, d) => set(f.key, d.checked)} label={v === true ? "Yes" : "No"} />
              </Field>
            );
          case "CHOICE":
            return (
              <Field key={f.id} {...common}>
                <Select value={typeof v === "string" ? v : ""} onChange={(_, d) => set(f.key, d.value)}>
                  <option value="">Select an option</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          case "NUMBER":
            return (
              <Field key={f.id} {...common}>
                <Input type="number" inputMode="decimal" value={typeof v === "string" ? v : ""} placeholder={`${f.label}, as a number`} onChange={(_, d) => set(f.key, d.value)} />
              </Field>
            );
          case "DATE":
            return (
              <Field key={f.id} {...common}>
                <Input type="date" value={typeof v === "string" ? v : ""} onChange={(_, d) => set(f.key, d.value)} />
              </Field>
            );
          default:
            return (
              <Field key={f.id} {...common}>
                <Input value={typeof v === "string" ? v : ""} maxLength={500} placeholder={f.label} onChange={(_, d) => set(f.key, d.value)} />
              </Field>
            );
        }
      })}
      <div className={s.actions}>
        <Button appearance="primary" type="submit" disabled={busy}>
          {busy ? "Saving" : "Save fields"}
        </Button>
        {saved && <Text className={s.muted}>Saved.</Text>}
      </div>
    </form>
  );
}

import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Add16Regular, Delete16Regular } from "@fluentui/react-icons";
import { useCallback, useState } from "react";
import type { CreatePricingInput, PricingConfig, PricingTier } from "@/lib/api/pricing";
import { useCreatePricingConfig, useUpdatePricingConfig } from "@/lib/api/pricing";
import { PricingPreview } from "./PricingPreview";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  fieldGrid: {
    display: "grid",
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: "1fr",
    "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, 1fr)" },
    "@media (min-width: 960px)": { gridTemplateColumns: "repeat(3, 1fr)" },
  },
  field: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  label: { fontSize: tokens.fontSizeBase200, fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground2 },
  tierRow: {
    display: "grid",
    gap: tokens.spacingHorizontalS,
    gridTemplateColumns: "60px 1fr 1fr 1fr auto",
    alignItems: "end",
    "@media (max-width: 639px)": { gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalXS },
  },
  tierOrder: { textAlign: "center", fontVariantNumeric: "tabular-nums", color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, paddingBottom: "8px" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  info: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, lineHeight: "1.5" },
  error: { color: tokens.colorPaletteRedForeground1, fontSize: tokens.fontSizeBase200 },
});

interface TierDraft {
  minimumQuantity: string;
  maximumQuantity: string;
  unitRate: string;
}

interface Props {
  tenantId: string;
  existing?: PricingConfig | null;
  onClose: () => void;
  onSaved: () => void;
}

function parseTiers(tiers: PricingTier[]): TierDraft[] {
  return tiers.map((t) => ({
    minimumQuantity: String(t.minimumQuantity),
    maximumQuantity: t.maximumQuantity !== null ? String(t.maximumQuantity) : "",
    unitRate: t.unitRate,
  }));
}

export function PricingEditor({ tenantId, existing, onClose, onSaved }: Props) {
  const s = useStyles();
  const createMutation = useCreatePricingConfig();
  const updateMutation = useUpdatePricingConfig();

  const [model, setModel] = useState<"GRADUATED" | "VOLUME">(existing?.pricingModel ?? "GRADUATED");
  const [currency, setCurrency] = useState(existing?.currency ?? "USD");
  const [period, setPeriod] = useState(existing?.billingPeriod ?? "MONTHLY");
  const [effectiveFrom, setEffectiveFrom] = useState(existing?.effectiveFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState(existing?.effectiveTo?.slice(0, 10) ?? "");
  const [tiers, setTiers] = useState<TierDraft[]>(
    existing?.tiers?.length ? parseTiers(existing.tiers) : [{ minimumQuantity: "1", maximumQuantity: "", unitRate: "0.00" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmActivate, setConfirmActivate] = useState(false);

  const addTier = useCallback(() => {
    setTiers((prev) => {
      const lastMax = prev.length > 0 ? Number(prev[prev.length - 1].maximumQuantity) : 0;
      const newMin = lastMax > 0 ? lastMax + 1 : (prev.length === 0 ? 1 : 1);
      return [...prev, { minimumQuantity: String(newMin), maximumQuantity: "", unitRate: "0.00" }];
    });
  }, []);

  const removeTier = useCallback((index: number) => {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateTier = useCallback((index: number, field: keyof TierDraft, value: string) => {
    setTiers((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const updated = { ...t, [field]: value };
        if (field === "maximumQuantity" && i < prev.length - 1) {
          // Auto-fill next tier's min
        }
        return updated;
      }),
    );
  }, []);

  const buildInput = useCallback(
    (status: string): CreatePricingInput | null => {
      setError(null);
      if (tiers.length === 0) { setError("Add at least one pricing tier."); return null; }

      const builtTiers: Omit<PricingTier, "id">[] = [];
      for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        const min = Number(t.minimumQuantity);
        const max = t.maximumQuantity.trim() === "" ? null : Number(t.maximumQuantity);
        const rate = t.unitRate.trim();

        if (isNaN(min) || min < 1) { setError(`Tier ${i + 1}: minimum must be at least 1.`); return null; }
        if (max !== null && (isNaN(max) || max < min)) { setError(`Tier ${i + 1}: maximum must be greater than or equal to minimum.`); return null; }
        if (rate === "" || isNaN(Number(rate)) || Number(rate) < 0) { setError(`Tier ${i + 1}: rate must be a non-negative number.`); return null; }

        if (i === 0 && min !== 1) { setError("First tier must start at 1."); return null; }
        if (i > 0) {
          const prevMax = builtTiers[i - 1].maximumQuantity;
          if (prevMax === null) { setError("Only the last tier may have an open maximum."); return null; }
          if (min !== prevMax + 1) { setError(`Tier ${i + 1}: must start at ${prevMax + 1} (no gaps).`); return null; }
        }
        if (max === null && i < tiers.length - 1) { setError("Only the last tier may have an open maximum."); return null; }

        builtTiers.push({ minimumQuantity: min, maximumQuantity: max, unitRate: rate, tierOrder: i + 1 });
      }

      return {
        tenantId,
        pricingModel: model,
        billingPeriod: period,
        currency,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
        status,
        tiers: builtTiers,
      };
    },
    [tenantId, model, period, currency, effectiveFrom, effectiveTo, tiers],
  );

  const handleSave = useCallback(
    async (status: string) => {
      const input = buildInput(status);
      if (!input) return;
      try {
        if (existing) {
          await updateMutation.mutateAsync({ id: existing.id, input });
        } else {
          await createMutation.mutateAsync(input);
        }
        onSaved();
      } catch (err) {
        setError((err as Error).message || "Failed to save");
      }
    },
    [buildInput, existing, createMutation, updateMutation, onSaved],
  );

  const previewTiers = tiers
    .map((t, i) => ({
      minimumQuantity: Number(t.minimumQuantity) || 1,
      maximumQuantity: t.maximumQuantity.trim() === "" ? null : (Number(t.maximumQuantity) || null),
      unitRate: t.unitRate || "0",
      tierOrder: i + 1,
    }))
    .filter((t) => t.minimumQuantity > 0);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className={s.root}>
      <Text size={500} weight="semibold">{existing ? "Edit pricing configuration" : "New pricing configuration"}</Text>

      <Card>
        <div className={s.fieldGrid}>
          <div className={s.field}>
            <Text className={s.label}>Pricing model</Text>
            <Select value={model} onChange={(_, d) => setModel(d.value as "GRADUATED" | "VOLUME")}>
              <option value="GRADUATED">Graduated (tiered)</option>
              <option value="VOLUME">Volume</option>
            </Select>
          </div>
          <div className={s.field}>
            <Text className={s.label}>Currency</Text>
            <Select value={currency} onChange={(_, d) => setCurrency(d.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
              <option value="AUD">AUD</option>
            </Select>
          </div>
          <div className={s.field}>
            <Text className={s.label}>Billing period</Text>
            <Select value={period} onChange={(_, d) => setPeriod(d.value)}>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUAL">Annual</option>
            </Select>
          </div>
          <div className={s.field}>
            <Text className={s.label}>Effective from</Text>
            <Input type="date" value={effectiveFrom} onChange={(_, d) => setEffectiveFrom(d.value)} />
          </div>
          <div className={s.field}>
            <Text className={s.label}>Effective to (optional)</Text>
            <Input type="date" value={effectiveTo} onChange={(_, d) => setEffectiveTo(d.value)} />
          </div>
        </div>

        <Text className={s.info}>
          {model === "GRADUATED"
            ? "Graduated pricing: each tier's rate applies only to the procedures within that range. Lower tiers are charged at their own rate."
            : "Volume pricing: once total usage reaches a tier, that tier's rate applies to all procedures in the billing period."}
        </Text>
      </Card>

      <Card>
        <Text weight="semibold" size={400}>Usage tiers</Text>
        {tiers.map((tier, i) => (
          <div key={i} className={s.tierRow}>
            <Text className={s.tierOrder}>{i + 1}</Text>
            <div className={s.field}>
              <Text className={s.label}>Min</Text>
              <Input
                size="small"
                type="number"
                min={1}
                value={tier.minimumQuantity}
                onChange={(_, d) => updateTier(i, "minimumQuantity", d.value)}
              />
            </div>
            <div className={s.field}>
              <Text className={s.label}>Max</Text>
              <Input
                size="small"
                type="number"
                min={1}
                placeholder="Open"
                value={tier.maximumQuantity}
                onChange={(_, d) => updateTier(i, "maximumQuantity", d.value)}
              />
            </div>
            <div className={s.field}>
              <Text className={s.label}>Rate per unit</Text>
              <Input
                size="small"
                type="number"
                step="0.01"
                min={0}
                value={tier.unitRate}
                onChange={(_, d) => updateTier(i, "unitRate", d.value)}
              />
            </div>
            <Button
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              disabled={tiers.length <= 1}
              onClick={() => removeTier(i)}
              style={{ marginBottom: "2px" }}
            />
          </div>
        ))}
        <Button appearance="subtle" icon={<Add16Regular />} onClick={addTier} size="small">
          Add tier
        </Button>
      </Card>

      <PricingPreview pricingModel={model} currency={currency} tiers={previewTiers} />

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <div className={s.actions}>
        <Button appearance="primary" onClick={() => handleSave("DRAFT")} disabled={isPending}>
          {isPending ? "Saving..." : "Save as draft"}
        </Button>
        <Button appearance="primary" onClick={() => setConfirmActivate(true)} disabled={isPending}>
          Save and activate
        </Button>
        <Button appearance="secondary" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
      </div>

      {confirmActivate && (
        <Dialog open onOpenChange={(_, d) => { if (!d.open) setConfirmActivate(false); }}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Activate this pricing configuration?</DialogTitle>
              <DialogContent>
                This will apply these rates to the tenant's procedure billing immediately.
                Any overlapping active configuration will need to be deactivated first.
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" onClick={() => setConfirmActivate(false)}>Cancel</Button>
                <Button appearance="primary" onClick={() => { setConfirmActivate(false); void handleSave("ACTIVE"); }}>
                  Activate
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}

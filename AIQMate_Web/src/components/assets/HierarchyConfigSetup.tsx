import {
  Button,
  Card,
  Input,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Add16Regular, Delete16Regular, ArrowUp16Regular, ArrowDown16Regular } from "@fluentui/react-icons";
import { useCallback, useState } from "react";
import { useSaveHierarchyConfig } from "@/lib/api/assetHierarchy";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalXXL,
    maxWidth: "640px",
    margin: "0 auto",
  },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM, width: "100%" },
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  order: {
    width: "28px",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    flexShrink: 0,
  },
  inputs: { display: "flex", gap: tokens.spacingHorizontalS, flexGrow: 1, flexWrap: "wrap", minWidth: 0 },
  actions: { display: "flex", gap: "2px", flexShrink: 0 },
  error: { color: tokens.colorPaletteRedForeground1 },
  presets: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

interface LevelRow {
  key: string;
  displayName: string;
  pluralName: string;
}

const PRESET_MANUFACTURING: LevelRow[] = [
  { key: "organization", displayName: "Organization", pluralName: "Organizations" },
  { key: "division", displayName: "Division", pluralName: "Divisions" },
  { key: "plant", displayName: "Plant", pluralName: "Plants" },
  { key: "area", displayName: "Area", pluralName: "Areas" },
  { key: "line", displayName: "Production Line", pluralName: "Production Lines" },
  { key: "equipment", displayName: "Equipment", pluralName: "Equipment" },
  { key: "component", displayName: "Component", pluralName: "Components" },
];

const PRESET_SIMPLE: LevelRow[] = [
  { key: "organization", displayName: "Organization", pluralName: "Organizations" },
  { key: "location", displayName: "Location", pluralName: "Locations" },
  { key: "equipment", displayName: "Equipment", pluralName: "Equipment" },
];

export function HierarchyConfigSetup({ userId }: { userId: string }) {
  const s = useStyles();
  const saveMutation = useSaveHierarchyConfig(userId);
  const [rows, setRows] = useState<LevelRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      { key: "", displayName: "", pluralName: "" },
    ]);
  }, []);

  const removeRow = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const moveRow = useCallback((idx: number, direction: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const updateRow = useCallback((idx: number, field: keyof LevelRow, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: value };
        if (field === "displayName" && !r.pluralName) {
          updated.pluralName = value.endsWith("s") ? value : `${value}s`;
        }
        if (field === "displayName" && !r.key) {
          updated.key = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        }
        return updated;
      }),
    );
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    if (rows.length === 0) {
      setError("Add at least one hierarchy level.");
      return;
    }
    for (const r of rows) {
      if (!r.key.trim() || !r.displayName.trim()) {
        setError("Every level needs a key and a display name.");
        return;
      }
    }
    const keys = rows.map((r) => r.key);
    if (new Set(keys).size !== keys.length) {
      setError("Level keys must be unique.");
      return;
    }
    try {
      await saveMutation.mutateAsync({
        levels: rows.map((r, i) => ({
          levelKey: r.key,
          displayName: r.displayName,
          pluralName: r.pluralName || `${r.displayName}s`,
          levelOrder: i + 1,
          isEnabled: true,
          isRootLevel: i === 0,
          allowMultipleChildren: true,
        })),
      });
    } catch {
      setError("Could not save. The backend API may not be connected yet.");
    }
  }, [rows, saveMutation]);

  return (
    <div className={s.root}>
      <Text size={600} weight="semibold">Configure your asset hierarchy</Text>
      <Text>
        Define the levels for your operational hierarchy. Each tenant can have a different structure.
        You can always change this later.
      </Text>

      <div className={s.presets}>
        <Button appearance="outline" size="small" onClick={() => setRows([...PRESET_MANUFACTURING])}>
          Manufacturing preset
        </Button>
        <Button appearance="outline" size="small" onClick={() => setRows([...PRESET_SIMPLE])}>
          Simple preset
        </Button>
      </div>

      <Card className={s.card}>
        {rows.map((row, idx) => (
          <div key={idx} className={s.row}>
            <Text className={s.order}>{idx + 1}</Text>
            <div className={s.inputs}>
              <Input
                size="small"
                placeholder="Display name"
                value={row.displayName}
                onChange={(_, d) => updateRow(idx, "displayName", d.value)}
                style={{ flexGrow: 1, minWidth: "120px" }}
              />
              <Input
                size="small"
                placeholder="Key (lowercase)"
                value={row.key}
                onChange={(_, d) => updateRow(idx, "key", d.value)}
                style={{ width: "120px" }}
              />
            </div>
            <span className={s.actions}>
              <Button appearance="subtle" size="small" icon={<ArrowUp16Regular />} disabled={idx === 0} onClick={() => moveRow(idx, -1)} />
              <Button appearance="subtle" size="small" icon={<ArrowDown16Regular />} disabled={idx === rows.length - 1} onClick={() => moveRow(idx, 1)} />
              <Button appearance="subtle" size="small" icon={<Delete16Regular />} onClick={() => removeRow(idx)} />
            </span>
          </div>
        ))}

        <Button appearance="subtle" icon={<Add16Regular />} onClick={addRow}>
          Add level
        </Button>
      </Card>

      {error && <Text className={s.error}>{error}</Text>}

      <Button appearance="primary" onClick={handleSave} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? "Saving..." : "Save hierarchy configuration"}
      </Button>
    </div>
  );
}

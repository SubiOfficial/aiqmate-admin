import {
  Card,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useCallback, useEffect, useState } from "react";
import { usePricingPreview, type PricingTier } from "@/lib/api/pricing";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalM, flexWrap: "wrap" },
  total: { display: "flex", alignItems: "baseline", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalS },
  error: { color: tokens.colorPaletteRedForeground1, fontSize: tokens.fontSizeBase200 },
  scroll: { overflowX: "auto", maxWidth: "100%" },
  table: { tableLayout: "auto", minWidth: "400px" },
  num: { fontVariantNumeric: "tabular-nums", textAlign: "right" },
});

interface Props {
  pricingModel: "GRADUATED" | "VOLUME";
  currency: string;
  tiers: Omit<PricingTier, "id">[];
}

export function PricingPreview({ pricingModel, currency, tiers }: Props) {
  const s = useStyles();
  const [qty, setQty] = useState(100);
  const preview = usePricingPreview();

  const calculate = useCallback(() => {
    if (tiers.length === 0 || qty <= 0) return;
    const validTiers = tiers.filter((t) => t.minimumQuantity > 0 && Number(t.unitRate) >= 0);
    if (validTiers.length === 0) return;
    preview.mutate({ pricingModel, quantity: qty, currency, tiers: validTiers });
  }, [pricingModel, currency, tiers, qty, preview]);

  useEffect(() => {
    const timer = setTimeout(calculate, 400);
    return () => clearTimeout(timer);
  }, [calculate]);

  return (
    <Card className={s.root}>
      <div className={s.header}>
        <Text weight="semibold" size={400}>Pricing preview</Text>
        <Input
          type="number"
          size="small"
          min={0}
          value={String(qty)}
          onChange={(_, d) => setQty(Math.max(0, Number(d.value) || 0))}
          contentBefore={<Text size={200}>Quantity</Text>}
          style={{ width: "160px" }}
        />
      </div>

      {preview.isPending && <Spinner size="tiny" label="Calculating..." />}
      {preview.isError && (
        <Text className={s.error}>
          {(preview.error as Error).message || "Could not calculate preview"}
        </Text>
      )}

      {preview.data && preview.data.lines.length > 0 && (
        <>
          <div className={s.scroll}>
            <Table className={s.table} size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Slab</TableHeaderCell>
                  <TableHeaderCell className={s.num}>Quantity</TableHeaderCell>
                  <TableHeaderCell className={s.num}>Rate</TableHeaderCell>
                  <TableHeaderCell className={s.num}>Amount</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.data.lines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {line.slabMin}{line.slabMax !== null ? ` - ${line.slabMax}` : "+"}
                    </TableCell>
                    <TableCell className={s.num}>{line.qty.toLocaleString()}</TableCell>
                    <TableCell className={s.num}>{currency} {line.unitRate}</TableCell>
                    <TableCell className={s.num}>{currency} {line.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className={s.total}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Total:</Text>
            <Text size={500} weight="bold">{currency} {preview.data.subtotal}</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              ({pricingModel === "GRADUATED" ? "Graduated" : "Volume"}, {qty.toLocaleString()} procedures)
            </Text>
          </div>
        </>
      )}

      {preview.data && preview.data.lines.length === 0 && qty === 0 && (
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Enter a quantity above 0 to see the breakdown.</Text>
      )}
    </Card>
  );
}

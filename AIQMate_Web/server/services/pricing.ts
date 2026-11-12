import Decimal from "decimal.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PricingModel = "GRADUATED" | "VOLUME";

export interface PricingSlab {
  slabMin: number;
  slabMax: number | null;
  unitRate: string;
  tierOrder: number;
}

export interface PricingConfig {
  model: PricingModel;
  currency: string;
  slabs: PricingSlab[];
}

export interface PricingLine {
  slabMin: number;
  slabMax: number | null;
  qty: number;
  unitRate: string;
  amount: string;
}

export interface PricingResult {
  model: PricingModel;
  currency: string;
  quantity: number;
  lines: PricingLine[];
  subtotal: string;
}

export class PricingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PricingError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Slab validation
// ---------------------------------------------------------------------------

export interface SlabValidationError {
  index: number;
  message: string;
}

export function validateSlabs(slabs: PricingSlab[]): SlabValidationError[] {
  const errors: SlabValidationError[] = [];
  if (slabs.length === 0) {
    errors.push({ index: -1, message: "At least one slab is required." });
    return errors;
  }

  const sorted = [...slabs].sort((a, b) => a.tierOrder - b.tierOrder);

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];

    if (s.slabMin < 1) {
      errors.push({ index: i, message: `Slab ${i + 1}: minimum must be at least 1.` });
    }

    if (s.slabMax !== null && s.slabMax < s.slabMin) {
      errors.push({ index: i, message: `Slab ${i + 1}: maximum (${s.slabMax}) is less than minimum (${s.slabMin}).` });
    }

    const rate = new Decimal(s.unitRate);
    if (rate.isNeg()) {
      errors.push({ index: i, message: `Slab ${i + 1}: unit rate must not be negative.` });
    }

    if (i === 0 && s.slabMin !== 1) {
      errors.push({ index: i, message: `First slab must start at 1, found ${s.slabMin}.` });
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      if (prev.slabMax === null) {
        errors.push({ index: i, message: `Slab ${i + 1}: only the last slab may have an open-ended maximum. Slab ${i} already has no upper limit.` });
      } else {
        const expectedMin = prev.slabMax + 1;
        if (s.slabMin !== expectedMin) {
          errors.push({ index: i, message: `Slab ${i + 1}: expected minimum ${expectedMin} (previous max ${prev.slabMax} + 1), found ${s.slabMin}.` });
        }
      }
    }

    if (i < sorted.length - 1 && s.slabMax === null) {
      errors.push({ index: i, message: `Slab ${i + 1}: only the last slab may have an open-ended maximum.` });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

export function validatePricingConfig(config: PricingConfig): string[] {
  const errors: string[] = [];

  if (config.model !== "GRADUATED" && config.model !== "VOLUME") {
    errors.push(`Invalid pricing model "${config.model}". Must be GRADUATED or VOLUME.`);
  }

  if (!config.currency || config.currency.trim().length === 0) {
    errors.push("Currency is required.");
  }

  const slabErrors = validateSlabs(config.slabs);
  for (const e of slabErrors) {
    errors.push(e.message);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Core pricing calculation
// ---------------------------------------------------------------------------

export function priceUsage(config: PricingConfig, Q: number): PricingResult {
  if (!Number.isInteger(Q) || Q < 0) {
    throw new PricingError("INVALID_QUANTITY", `Quantity must be a non-negative integer, got ${Q}.`);
  }

  const configErrors = validatePricingConfig(config);
  if (configErrors.length > 0) {
    throw new PricingError("PRICING_CONFIGURATION_INVALID", configErrors.join(" "));
  }

  const sorted = [...config.slabs].sort((a, b) => a.tierOrder - b.tierOrder);

  if (Q === 0) {
    return {
      model: config.model,
      currency: config.currency,
      quantity: 0,
      lines: [],
      subtotal: "0.00",
    };
  }

  const lastSlab = sorted[sorted.length - 1];
  if (lastSlab.slabMax !== null && Q > lastSlab.slabMax) {
    throw new PricingError(
      "PRICING_COVERAGE_MISSING",
      `Usage of ${Q} exceeds the highest configured slab maximum of ${lastSlab.slabMax}.`,
    );
  }

  if (config.model === "GRADUATED") {
    return calculateGraduated(config, sorted, Q);
  }
  return calculateVolume(config, sorted, Q);
}

function calculateGraduated(
  config: PricingConfig,
  slabs: PricingSlab[],
  Q: number,
): PricingResult {
  const lines: PricingLine[] = [];
  let subtotal = new Decimal(0);

  for (const s of slabs) {
    const upper = s.slabMax ?? Infinity;
    const qty = Math.max(0, Math.min(Q, upper) - s.slabMin + 1);

    if (qty <= 0) break;

    const rate = new Decimal(s.unitRate);
    const amount = rate.mul(qty);
    subtotal = subtotal.plus(amount);

    lines.push({
      slabMin: s.slabMin,
      slabMax: s.slabMax,
      qty,
      unitRate: s.unitRate,
      amount: amount.toFixed(2),
    });
  }

  return {
    model: config.model,
    currency: config.currency,
    quantity: Q,
    lines,
    subtotal: subtotal.toFixed(2),
  };
}

function calculateVolume(
  config: PricingConfig,
  slabs: PricingSlab[],
  Q: number,
): PricingResult {
  const applicableSlab = slabs.find(
    (s) => Q >= s.slabMin && (s.slabMax === null || Q <= s.slabMax),
  );

  if (!applicableSlab) {
    throw new PricingError(
      "PRICING_COVERAGE_MISSING",
      `No slab covers usage of ${Q}.`,
    );
  }

  const rate = new Decimal(applicableSlab.unitRate);
  const amount = rate.mul(Q);

  return {
    model: config.model,
    currency: config.currency,
    quantity: Q,
    lines: [
      {
        slabMin: applicableSlab.slabMin,
        slabMax: applicableSlab.slabMax,
        qty: Q,
        unitRate: applicableSlab.unitRate,
        amount: amount.toFixed(2),
      },
    ],
    subtotal: amount.toFixed(2),
  };
}
